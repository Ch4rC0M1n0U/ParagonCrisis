import type { CSSProperties } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RoomAccessForm } from "@/components/forms/room-access-form";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { MetricCard } from "@/components/ui/metric-card";

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

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalRooms,
    activeRooms,
    totalParticipants,
    formateurCount,
    totalEvents,
    eventsLast7Days,
    totalMessages,
    messagesLast24h,
    criticalOpenCount,
    latestEvent,
    lastActiveRoom,
  ] = await Promise.all([
    prisma.room.count(),
    prisma.room.count({ where: { isActive: true } }),
    prisma.participant.count(),
    prisma.participant.count({ where: { role: "formateur" } }),
    prisma.crisisEvent.count(),
    prisma.crisisEvent.count({ where: { triggeredAt: { gte: sevenDaysAgo } } }),
    prisma.message.count(),
    prisma.message.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.crisisEvent.count({ where: { severity: "CRITICAL", ackAt: null } }),
    prisma.crisisEvent.findFirst({
      orderBy: { triggeredAt: "desc" },
      include: { room: { select: { code: true, title: true } } },
    }),
    prisma.room.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const numberFormatter = new Intl.NumberFormat("fr-FR");

  const heroMetrics = [
    {
      label: "Rooms créées",
      value: numberFormatter.format(totalRooms),
      detail:
        activeRooms > 0
          ? `${numberFormatter.format(activeRooms)} actives`
          : "Aucune room active actuellement",
    },
    {
      label: "Participants enregistrés",
      value: numberFormatter.format(totalParticipants),
      detail:
        formateurCount > 0
          ? `${numberFormatter.format(formateurCount)} formateurs`
          : "Formateurs non renseignés pour l’instant",
    },
    {
      label: "Événements simulés",
      value: numberFormatter.format(totalEvents),
      detail:
        eventsLast7Days > 0
          ? `${numberFormatter.format(eventsLast7Days)} sur les 7 derniers jours`
          : "En attente des premiers événements",
    },
  ] as const;

  const activityHighlights = [
    {
      badge: "Rooms actives",
      value: numberFormatter.format(activeRooms),
      description:
        lastActiveRoom != null
          ? `Dernière activité ${formatRelativeTime(lastActiveRoom.updatedAt)} – ${lastActiveRoom.code}`
          : "Aucune room active pour le moment.",
    },
    {
      badge: "Messages (24h)",
      value: numberFormatter.format(messagesLast24h),
      description:
        totalMessages > 0
          ? `${numberFormatter.format(totalMessages)} messages enregistrés au total.`
          : "Les participants n’ont pas encore échangé.",
    },
    {
      badge: "Alertes critiques",
      value: numberFormatter.format(criticalOpenCount),
      description:
        latestEvent != null
          ? `Dernier événement ${formatRelativeTime(latestEvent.triggeredAt)} – ${latestEvent.room?.code ?? "room inconnue"}`
          : "Aucun événement enregistré pour l’instant.",
    },
  ] as const;

  const gradientStyle: CSSProperties = {
    background:
      "radial-gradient(circle at top left, rgba(15,157,138,0.16), transparent 45%), radial-gradient(circle at bottom right, rgba(11,85,96,0.12), transparent 40%)",
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content" style={gradientStyle}>
  <div className="mx-auto w-full max-w-6xl md:max-w-[85vw] px-6 pb-24">
        <header className="py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-xl">⚡</div>
              <span className="text-sm font-semibold uppercase tracking-[0.35em] text-primary/80">
                ParagonCrisis
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href="/admin" className="btn btn-ghost btn-sm">
                Panneau formateur
              </Link>
              <Link href="#forms" className="btn btn-primary btn-sm">
                Démarrer
              </Link>
            </div>
          </div>

          <div className="relative mt-10 grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary/80">
                Simulations temps réel
              </span>
              <div className="space-y-5">
                <h1 className="text-4xl font-semibold leading-tight text-neutral md:text-5xl">
                  Entraînez vos équipes à gérer l’imprévu en toute sérénité
                </h1>
                <p className="text-base leading-relaxed text-base-content/80 md:text-lg">
                  Créez une salle de crise en quelques secondes, orchestrez des événements manuels ou probabilistes et suivez l’impact en temps réel grâce à un tableau de bord pilotable.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="#forms" className="btn btn-primary">Créer une room</Link>
                  <Link href="/admin" className="btn btn-outline">Voir le command center</Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.detail}
                    className="bg-white/90"
                    accentClassName="bg-primary/40"
                    deltaTone="neutral"
                  />
                ))}
              </div>
            </div>

            <div id="forms" className="relative">
              <div className="pointer-events-none absolute -top-12 right-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-12 left-0 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" aria-hidden />
              <div className="relative rounded-3xl border border-base-200/80 bg-white/95 p-6 shadow-xl backdrop-blur">
                <h2 className="text-lg font-semibold text-neutral">Rejoindre ou créer une simulation</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  Choisissez un code unique pour lancer votre salle ou saisissez celui reçu pour rejoindre une session.
                </p>
                <div className="mt-6 space-y-6">
                  <RoomAccessForm variant="create" />
                  <div className="divider my-2">ou</div>
                  <RoomAccessForm variant="join" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-col gap-16">
          <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-5">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">Aperçu</span>
              <h2 className="text-3xl font-semibold text-neutral">Pourquoi ParagonCrisis ?</h2>
              <p className="text-base leading-relaxed text-base-content/80">
                Offrez un environnement immersif pour tester la résilience de vos équipes. Le formateur contrôle le tempo tandis que le scheduler déclenche des perturbations aléatoires. Les participants réagissent via un chat temps réel et une timeline partagée.
              </p>
              <ul className="space-y-3 text-sm text-base-content/80">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                  Gestion simultanée des flux SYSTEM, CHAT et EVENT pour une vision unifiée.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-secondary" aria-hidden />
                  Beep audio dédié aux alertes critiques avec composant audio persistant.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                  Persistance Prisma & SQLite pour rejouer la session et générer des rapports.
                </li>
              </ul>
            </div>
            <FeatureGrid />
          </section>

          <section className="rounded-3xl border border-base-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h2 className="text-2xl font-semibold text-neutral">Activité récente</h2>
            <p className="mt-3 text-sm leading-relaxed text-base-content/70">
              Surveillez en un coup d’œil les rooms actives, l’engagement des participants et les alertes critiques générées par vos simulations.
            </p>
            <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
              {activityHighlights.map((highlight) => (
                <div
                  key={highlight.badge}
                  className="flex flex-col gap-2 rounded-2xl border border-base-200/70 bg-base-100/80 p-4"
                >
                  <span className="badge badge-sm border-primary/20 bg-primary/10 text-primary">
                    {highlight.badge}
                  </span>
                  <span className="text-2xl font-semibold text-neutral">{highlight.value}</span>
                  <span className="text-xs text-base-content/70">{highlight.description}</span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
