import Link from "next/link";
import { revalidatePath } from "next/cache";
import { MetricCard } from "@/components/ui/metric-card";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { prisma } from "@/lib/prisma";
import { stopRoomScheduler } from "@/server/scheduler/crisis-scheduler";
import { AdminShell } from "@/components/admin/admin-shell";

interface CloseRoomInput {
  roomId: string;
  roomCode: string;
}

async function closeRoomAction({ roomId, roomCode }: CloseRoomInput) {
  "use server";

  if (!roomId || !roomCode) {
    return;
  }

  try {
    // Désactiver la room
    await prisma.room.update({
      where: { id: roomId },
      data: { isActive: false },
    });

    // Déconnecter tous les participants
    await prisma.participant.updateMany({
      where: { roomId, isConnected: true },
      data: { isConnected: false, leftAt: new Date() },
    });

    // Arrêter le scheduler
    stopRoomScheduler(roomCode.toUpperCase());

    // Optionnel: notifier les clients connectés via Socket.IO
    try {
      const { getSocketServer } = await import("@/server/realtime/socket-server");
      const io = getSocketServer();
      io.to(roomCode.toUpperCase()).emit("system:announcement", {
        message: "Cette salle a été fermée par un administrateur. Vous allez être déconnecté.",
      });
      // Forcer la déconnexion des sockets de cette room
      const sockets = await io.in(roomCode.toUpperCase()).fetchSockets();
      for (const socket of sockets) {
        socket.leave(roomCode.toUpperCase());
        socket.disconnect(true);
      }
    } catch (socketError) {
      // Socket.IO pas encore initialisé, pas grave
      console.warn("Impossible de notifier les clients Socket.IO:", socketError);
    }

  } catch (error) {
    console.error("Erreur lors de la fermeture de la room:", error);
  } finally {
    revalidatePath("/admin");
  }
}

function formatRelativeTime(date: Date) {
  const diffSeconds = (date.getTime() - Date.now()) / 1000;
  const divisions: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ];

  const formatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), "year");
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  }
  return `${seconds} s`;
}

function severityBadge(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "badge-error";
    case "HIGH":
      return "badge-warning";
    case "LOW":
      return "badge-success";
    default:
      return "badge-info";
  }
}

const INTEGRATIONS = [
  { name: "Slack", description: "Notifications temps réel aux équipes.", action: "Connecter" },
  { name: "Teams", description: "Diffusez les alertes dans vos salons MS Teams.", action: "Configurer" },
  { name: "PagerDuty", description: "Escalade automatique pour incidents critiques.", action: "Connecter" },
  { name: "Notion", description: "Synchronisez vos playbooks de crise.", action: "Bientôt" },
] as const;

export default async function AdminPage() {
  const now = new Date();
  const analyticsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const liveWindowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const numberFormatter = new Intl.NumberFormat("fr-FR");

  const [rooms, recentEvents, analyticsEvents, analyticsMessages, criticalOpenCount] = await Promise.all([
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: {
          select: { id: true, isConnected: true },
        },
        crisisEvents: {
          orderBy: { triggeredAt: "desc" },
          take: 1,
          select: { triggeredAt: true, title: true, severity: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        _count: {
          select: {
            participants: true,
            crisisEvents: true,
            messages: true,
          },
        },
      },
    }),
    prisma.crisisEvent.findMany({
      orderBy: { triggeredAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        severity: true,
        source: true,
        triggeredAt: true,
        room: { select: { code: true, title: true } },
      },
    }),
    prisma.crisisEvent.findMany({
      where: { triggeredAt: { gte: analyticsStart } },
      select: { triggeredAt: true, ackAt: true, severity: true },
    }),
    prisma.message.findMany({
      where: { createdAt: { gte: analyticsStart } },
      select: { createdAt: true },
    }),
    prisma.crisisEvent.count({ where: { severity: "CRITICAL", ackAt: null } }),
  ]);

  const totalRooms = rooms.length;
  const totalParticipants = rooms.reduce((acc, room) => acc + room._count.participants, 0);
  const totalEvents = rooms.reduce((acc, room) => acc + room._count.crisisEvents, 0);
  const connectedParticipants = rooms.reduce(
    (acc, room) => acc + room.participants.filter((participant) => participant.isConnected).length,
    0,
  );

  const months = Array.from({ length: 6 }, (_, index) => new Date(analyticsStart.getFullYear(), analyticsStart.getMonth() + index, 1));
  const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const isSameMonth = (value: Date, reference: Date) =>
    value.getFullYear() === reference.getFullYear() && value.getMonth() === reference.getMonth();

  const monthlyMessageSeries = months.map((monthDate) =>
    analyticsMessages.filter((message) => isSameMonth(message.createdAt, monthDate)).length,
  );
  const chartLabels = months.map((monthDate) => monthFormatter.format(monthDate));

  const ackedEvents = analyticsEvents.filter((event) => event.ackAt !== null);
  const averageAckMs =
    ackedEvents.length > 0
      ?
          ackedEvents.reduce(
            (acc, event) => acc + ((event.ackAt as Date).getTime() - event.triggeredAt.getTime()),
            0,
          ) / ackedEvents.length
      : null;
  const averageAckDisplay = averageAckMs !== null ? formatDuration(averageAckMs) : "—";

  const ackRate = analyticsEvents.length > 0 ? ackedEvents.length / analyticsEvents.length : null;
  const ackRateDisplay =
    ackRate !== null
      ? new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(ackRate)
      : "—";

  const messagesVolumeSixMonths = numberFormatter.format(analyticsMessages.length);
  const criticalOpenDisplay = numberFormatter.format(criticalOpenCount);
  const messagesLastHour = analyticsMessages.filter((message) => message.createdAt >= liveWindowStart).length;
  const messagesLastHourDisplay = numberFormatter.format(messagesLastHour);

  return (
    <AdminShell active="dashboard">
      <header className="flex flex-col gap-6 rounded-3xl border border-base-200/70 bg-white/80 p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.4em] text-primary/70">Tableau de bord</p>
            <h1 className="text-4xl font-semibold text-neutral">Centre de commandement</h1>
            <p className="text-sm text-base-content/70">
              Vue consolidée des rooms, indicateurs d’engagement et derniers événements générés.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="btn btn-ghost gap-2">
              <span aria-hidden>🏠</span>
              Accueil
            </Link>
            <Link href="/landing" className="btn btn-outline gap-2">
              <span aria-hidden>�</span>
              Guide terrain
            </Link>
            <button type="button" className="btn btn-primary gap-2">
              <span aria-hidden>➕</span>
              Nouvelle room
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Rooms actives"
            value={totalRooms}
            delta={totalRooms > 3 ? "+8%" : undefined}
            accentClassName="bg-primary/40"
            hint="Synchronisées via Socket.IO"
          />
          <MetricCard
            label="Participants"
            value={totalParticipants}
            delta={`${connectedParticipants} connectés`}
            deltaTone="neutral"
            accentClassName="bg-secondary/40"
            hint="Présence cumulée"
          />
          <MetricCard
            label="Événements loggués"
            value={totalEvents}
            delta={totalEvents > 50 ? "+12%" : undefined}
            accentClassName="bg-accent/40"
            hint="Historique Prisma mis à jour"
          />
        </div>
      </header>

      <section
        id="rooms"
        className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)] xl:grid-cols-[minmax(0,1.75fr)_minmax(0,0.75fr)]"
      >
        <article className="rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-neutral">Rooms actives</h2>
              <p className="text-sm text-base-content/60">
                Accédez à une simulation, observez les messages et injectez de nouveaux événements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-sm">
                ⟳ Rafraîchir
              </button>
              <Link href="/room/demo?admin=1&name=Formateur" className="btn btn-primary btn-sm">
                Mode démo
              </Link>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-base-200/70">
            <table className="table table-lg min-w-[780px]">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-base-content/50">
                  <th className="whitespace-nowrap">Code</th>
                  <th className="min-w-[220px]">Titre</th>
                  <th className="whitespace-nowrap">Participants</th>
                  <th className="whitespace-nowrap">Événements</th>
                  <th className="whitespace-nowrap">Dernière activité</th>
                  <th className="whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-base-content/60">
                      Aucune room enregistrée pour le moment. Créez-en une depuis l’accueil.
                    </td>
                  </tr>
                ) : (
                  rooms.map((room) => {
                    const connected = room.participants.filter((participant) => participant.isConnected).length;
                    const lastEvent = room.crisisEvents[0]?.triggeredAt;
                    const lastMessage = room.messages[0]?.createdAt;
                    const lastActivity = [lastEvent, lastMessage, room.updatedAt]
                      .filter(Boolean)
                      .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;
                    const boundCloseRoom = closeRoomAction.bind(null, {
                      roomId: room.id,
                      roomCode: room.code,
                    });

                    return (
                      <tr key={room.id} className="hover:bg-primary/5">
                        <td className="font-mono text-sm whitespace-nowrap">{room.code}</td>
                        <td className="text-sm text-neutral">{room.title ?? "—"}</td>
                        <td className="whitespace-nowrap">
                          <span className="font-semibold text-neutral">{connected}</span>
                          <span className="text-xs text-base-content/60"> / {room._count.participants}</span>
                        </td>
                        <td className="whitespace-nowrap text-sm font-medium text-neutral">
                          {room._count.crisisEvents}
                        </td>
                        <td className="whitespace-nowrap text-xs text-base-content/60">
                          {lastActivity ? formatRelativeTime(lastActivity) : "—"}
                        </td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/room/${room.code}?admin=1&name=Formateur`}
                              className="btn btn-xs btn-primary"
                            >
                              Ouvrir
                            </Link>
                            <button type="button" className="btn btn-xs btn-outline">
                              Exports
                            </button>
                            <form action={boundCloseRoom} className="inline-flex">
                              <button type="submit" className="btn btn-xs btn-error btn-outline">
                                Fermer
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="flex flex-col gap-5 rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-neutral">Flux temps réel</h3>
              <p className="text-sm text-base-content/60">Messages échangés sur les 6 derniers mois.</p>
            </div>
            <span className="badge badge-outline border-primary/30 bg-primary/10 text-primary">
              Live · {messagesLastHourDisplay} msg/h
            </span>
          </header>
          <ChartSkeleton values={monthlyMessageSeries} labels={chartLabels} />
          <div className="grid gap-3 text-sm text-base-content/70">
            <div className="flex justify-between">
              <span>Volume messages (6 mois)</span>
              <span className="font-medium text-neutral">{messagesVolumeSixMonths}</span>
            </div>
            <div className="flex justify-between">
              <span>Temps de réaction moyen</span>
              <span className="font-medium text-neutral">{averageAckDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span>Taux d’accusé réception</span>
              <span className="font-medium text-neutral">{ackRateDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span>Alertes critiques non résolues</span>
              <span className={`font-medium ${criticalOpenCount > 0 ? "text-error" : "text-neutral"}`}>
                {criticalOpenDisplay}
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
          <header className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-neutral">Derniers événements</h3>
            <Link href="/room/demo?admin=1" className="btn btn-ghost btn-sm">
              Journal complet
            </Link>
          </header>
          <p className="mt-2 text-sm text-base-content/60">
            Les événements injectés récemment, qu’ils proviennent du scheduler ou de l’équipe formateur.
          </p>
          <ul className="mt-4 space-y-3">
            {recentEvents.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-base-300/80 px-4 py-6 text-center text-sm text-base-content/60">
                Aucun événement recensé pour l’instant.
              </li>
            ) : (
              recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-2 rounded-2xl border border-base-200/80 bg-base-100/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${severityBadge(event.severity)}`}>{event.severity}</span>
                      <span className="font-medium text-neutral">{event.title}</span>
                    </div>
                    <span className="text-xs text-base-content/60">{formatRelativeTime(event.triggeredAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/60">
                    <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                      Room {event.room.code}
                    </span>
                    <span>Source : {event.source}</span>
                    {event.room.title ? <span>{event.room.title}</span> : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article
          id="reports"
          className="flex flex-col gap-5 rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur"
        >
          <header>
            <h3 className="text-xl font-semibold text-neutral">Intégrations rapides</h3>
            <p className="mt-2 text-sm text-base-content/60">
              Connectez vos outils pour exporter rapports, signaux audio et triggers automatisés.
            </p>
          </header>
          <ul className="space-y-3">
            {INTEGRATIONS.map((integration) => (
              <li
                key={integration.name}
                className="flex items-center justify-between rounded-2xl border border-base-200/70 bg-base-100/70 px-4 py-4"
              >
                <div>
                  <p className="font-semibold text-neutral">{integration.name}</p>
                  <p className="text-xs text-base-content/60">{integration.description}</p>
                </div>
                <button type="button" className="btn btn-sm btn-outline">
                  {integration.action}
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-base-content/70">
            <p className="font-semibold text-neutral">API & exports</p>
            <p className="mt-1 text-xs">
              Exposez les événements triés par <code>createdAt</code> via notre endpoint JSON/CSV pour analyses post-mortem.
            </p>
            <Link href="/docs" className="btn btn-link px-0">
              Documentation API
            </Link>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
