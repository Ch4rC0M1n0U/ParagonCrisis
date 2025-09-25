"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MetricCard } from "@/components/ui/metric-card";
import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/server/realtime/socket-server";

interface ParticipantSnapshot {
  id: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  isConnected: boolean;
  joinedAt: string | null;
  leftAt: string | null;
}

interface MessageSnapshot {
  id: string;
  author: string;
  type: string;
  content: string;
  createdAt: string;
}

interface EventSnapshot {
  id: string;
  title: string;
  description: string;
  severity: string;
  source: string;
  triggeredAt: string;
  ackAt: string | null;
}

export interface RoomClientProps {
  roomCode: string;
  displayName: string;
  isAdmin: boolean;
  roomTitle: string;
  roomExists: boolean;
  initialParticipants: ParticipantSnapshot[];
  initialMessages: MessageSnapshot[];
  initialEvents: EventSnapshot[];
}

type ConnectionState = "connecting" | "connected" | "error";

type Notice = {
  id: string;
  variant: "info" | "error";
  message: string;
  createdAt: number;
};

function formatDate(iso: string) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return formatter.format(new Date(iso));
}

function formatRelative(iso: string) {
  const date = new Date(iso);
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

  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  let duration = diffSeconds;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return rtf.format(Math.round(duration), "year");
}

function useBeep() {
  const audioContextRef = useRef<AudioContext | null>(null);

  return useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const context = audioContextRef.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.0001;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    const now = context.currentTime;
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    oscillator.start(now);
    oscillator.stop(now + 0.4);
  }, []);
}

function connectionBadge(state: ConnectionState) {
  switch (state) {
    case "connected":
      return "badge-success";
    case "error":
      return "badge-error";
    default:
      return "badge-warning";
  }
}

const severityMap: Record<string, string> = {
  LOW: "badge-success",
  MODERATE: "badge-info",
  HIGH: "badge-warning",
  CRITICAL: "badge-error",
};

function normaliseParticipant(participant: ParticipantSnapshot) {
  return {
    ...participant,
    role: participant.role || (participant.isAdmin ? "formateur" : "participant"),
  } satisfies ParticipantSnapshot;
}

export function RoomClient(props: RoomClientProps) {
  const {
    roomCode,
    displayName,
    isAdmin,
    roomTitle,
    roomExists,
    initialParticipants,
    initialMessages,
    initialEvents,
  } = props;

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [participants, setParticipants] = useState<ParticipantSnapshot[]>(() =>
    initialParticipants.map(normaliseParticipant),
  );
  const [messages, setMessages] = useState<MessageSnapshot[]>(() =>
    [...initialMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  );
  const [events, setEvents] = useState<EventSnapshot[]>(() =>
    [...initialEvents].sort(
      (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    ),
  );
  const [chatInput, setChatInput] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventSeverity, setEventSeverity] = useState("MODERATE");
  const [sendingChat, setSendingChat] = useState(false);
  const [sendingEvent, setSendingEvent] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const triggerBeep = useBeep();

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "");
      }),
    [participants],
  );

  useEffect(() => {
    if (!chatContainerRef.current) {
      return;
    }
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages.length]);

  const pushNotice = useCallback((notice: Omit<Notice, "id" | "createdAt">) => {
    setNotices((current) => {
      const next: Notice = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ...notice,
      };
      return [...current.slice(-4), next];
    });
  }, []);

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_WS_URL;
    const options: Partial<ManagerOptions & SocketOptions> = {
      path: "/api/socket",
      transports: ["websocket"],
      reconnectionAttempts: 5,
    };

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = endpoint
      ? io(endpoint, options)
      : io(options);

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      socket.emit("room:join", {
        roomCode,
        displayName,
        isAdmin,
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("connecting");
    });

    socket.on("connect_error", (error) => {
      setConnectionState("error");
      pushNotice({
        variant: "error",
        message: `Connexion impossible au serveur temps réel (${error.message}).`,
      });
    });

    socket.on("system:announcement", (payload) => {
      pushNotice({ variant: "info", message: payload.message });
    });

    socket.on("system:error", (payload) => {
      setConnectionState("error");
      pushNotice({ variant: "error", message: payload.message });
    });

    socket.on("participant:update", (payload) => {
      setParticipants((prev) => {
        const merged = new Map<string, ParticipantSnapshot>();
        for (const participant of prev) {
          merged.set(participant.id, participant);
        }
        for (const participant of payload.participants) {
          const existing = merged.get(participant.id);
          merged.set(participant.id, normaliseParticipant({
            id: participant.id,
            displayName: participant.displayName,
            role: participant.role,
            isAdmin: participant.isAdmin,
            isConnected: participant.isConnected ?? existing?.isConnected ?? true,
            joinedAt: participant.joinedAt ?? existing?.joinedAt ?? null,
            leftAt: participant.leftAt ?? existing?.leftAt ?? null,
          }));
        }
        return Array.from(merged.values());
      });
    });

    socket.on("chat:message", (payload) => {
      setMessages((prev) => {
        if (prev.some((message) => message.id === payload.id)) {
          return prev;
        }
        const next = [
          ...prev,
          {
            id: payload.id,
            author: payload.author,
            type: "CHAT",
            content: payload.content,
            createdAt: payload.createdAt,
          },
        ];
        return next.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    });

    socket.on("event:created", async (payload) => {
      setEvents((prev) => {
        if (prev.some((event) => event.id === payload.id)) {
          return prev;
        }
        const next = [
          {
            id: payload.id,
            title: payload.title,
            description: payload.description,
            severity: payload.severity,
            source: payload.source,
            triggeredAt: payload.triggeredAt,
            ackAt: null,
          },
          ...prev,
        ];
        return next.sort(
          (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
        );
      });
      await triggerBeep();
    });

    return () => {
      socket.emit("room:leave", { roomCode });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [displayName, isAdmin, pushNotice, roomCode, triggerBeep]);

  const handleChatSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!socketRef.current || connectionState !== "connected" || !chatInput.trim()) {
        return;
      }
      setSendingChat(true);
      socketRef.current.emit("chat:message", {
        roomCode,
        content: chatInput.trim(),
      });
      setChatInput("");
      setSendingChat(false);
    },
    [chatInput, connectionState, roomCode],
  );

  const handleEventSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!socketRef.current || connectionState !== "connected") {
        return;
      }
      if (!eventTitle.trim() || !eventDescription.trim()) {
        pushNotice({
          variant: "error",
          message: "Renseignez un titre et une description pour l’événement.",
        });
        return;
      }
      setSendingEvent(true);
      socketRef.current.emit("event:create", {
        roomCode,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        severity: eventSeverity,
      });
      setEventDescription("");
      setEventTitle("");
      setEventSeverity("MODERATE");
      setSendingEvent(false);
    },
    [connectionState, eventDescription, eventSeverity, eventTitle, pushNotice, roomCode],
  );

  const latestNotice = notices.at(-1);
  const participantCount = sortedParticipants.length;
  const connectedCount = sortedParticipants.filter((participant) => participant.isConnected).length;
  const totalMessages = messages.length;
  const totalEvents = events.length;

  const heroBackground: CSSProperties = {
    background:
      "radial-gradient(circle at top left, rgba(15,157,138,0.18), transparent 45%), radial-gradient(circle at top right, rgba(11,85,96,0.14), transparent 40%)",
  };

  const overviewMetrics = [
    {
      label: "Participants actifs",
      value: `${connectedCount}/${participantCount}`,
      hint: `${connectedCount} connectés en direct`,
      delta: `${connectedCount} connectés` as const,
      deltaTone: "neutral" as const,
      accentClassName: "bg-primary/40",
    },
    {
      label: "Messages",
      value: totalMessages,
      hint: "fil synchronisé",
      accentClassName: "bg-secondary/40",
    },
    {
      label: "Événements",
      value: totalEvents,
      hint: "incl. scheduler",
      accentClassName: "bg-accent/40",
    },
  ];

  return (
    <div className="min-h-screen bg-base-100" style={heroBackground}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-base-200/70 bg-white/90 p-8 shadow-sm backdrop-blur">
            <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-secondary/15 blur-3xl" aria-hidden />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">
                  Salle {roomCode}
                </span>
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold text-neutral lg:text-4xl">{roomTitle}</h1>
                  <p className="text-sm text-base-content/70">
                    Connecté en tant que <span className="font-medium text-neutral">{displayName}</span>
                    {isAdmin ? " (formateur)" : ""}. Toutes les actions sont orchestrées via Socket.IO et historisées dans Prisma pour un débrief complet.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className={`badge ${connectionBadge(connectionState)} gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider`}>
                    <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                    {connectionState === "connected"
                      ? "Connecté"
                      : connectionState === "error"
                        ? "Erreur temps réel"
                        : "Connexion en cours"}
                  </span>
                  <span className="badge badge-outline border-base-300/60 bg-base-100/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral/80">
                    {participantCount} participants inscrits
                  </span>
                  <span className="badge badge-outline border-base-300/60 bg-base-100/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral/80">
                    {totalEvents} événements suivis
                  </span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {overviewMetrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.hint}
                    delta={metric.delta}
                    deltaTone={metric.deltaTone}
                    accentClassName={metric.accentClassName}
                    className="bg-white/80"
                  />
                ))}
              </div>
            </div>
          </div>

          {!roomExists && isAdmin ? (
            <div className="rounded-3xl border border-info/20 bg-info/10 px-6 py-4 text-info-content shadow-sm">
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold uppercase tracking-[0.25em]">Nouvelle salle</span>
                <span>
                  Cette salle sera créée automatiquement dès que vous resterez connecté. Partagez le code {roomCode} avec vos participants.
                </span>
              </div>
            </div>
          ) : null}

          {latestNotice ? (
            <div
              className={`rounded-3xl border px-6 py-4 shadow-sm ${latestNotice.variant === "error" ? "border-error/30 bg-error/10 text-error-content" : "border-primary/30 bg-primary/10 text-primary-content"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em]">
                    {latestNotice.variant === "error" ? "Alerte" : "Information"}
                  </p>
                  <p className="mt-1 text-sm">{latestNotice.message}</p>
                </div>
                <span className="text-xs text-base-content/60">
                  {new Date(latestNotice.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <article className="rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Timeline</p>
                  <h2 className="text-xl font-semibold text-neutral">Chronologie des événements</h2>
                </div>
                <span className="badge badge-outline border-primary/30 bg-primary/10 text-primary">EVENT</span>
              </header>
              <div className="mt-4 flex flex-col gap-3">
                {events.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-base-300/70 px-4 py-6 text-sm text-base-content/60">
                    Aucun événement pour le moment. Injectez-en un ou laissez le scheduler en déclencher.
                  </p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-base-200/80 bg-base-100/80 p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${severityMap[event.severity] ?? "badge-neutral"}`}>
                            {event.severity}
                          </span>
                          <h3 className="font-semibold text-neutral">{event.title}</h3>
                        </div>
                        <span className="text-xs text-base-content/60" title={formatDate(event.triggeredAt)}>
                          {formatRelative(event.triggeredAt)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-base-content/80">{event.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-base-content/60">
                        <span>Source : {event.source}</span>
                        {event.ackAt ? <span>Accusé de réception : {formatDate(event.ackAt)}</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary/70">Collaboration</p>
                  <h2 className="text-xl font-semibold text-neutral">Canal de discussion</h2>
                </div>
                <span className="badge badge-outline border-secondary/30 bg-secondary/10 text-secondary">CHAT</span>
              </header>
              <div
                ref={chatContainerRef}
                className="mt-4 h-72 space-y-3 overflow-y-auto rounded-2xl border border-base-200/60 bg-base-100/80 p-4"
              >
                {messages.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-base-300/70 px-4 py-6 text-sm text-base-content/60">
                    Aucune conversation pour le moment. Brisez la glace avec un premier message.
                  </p>
                ) : (
                  messages.map((message) => {
                    const mine = message.author === displayName;
                    return (
                      <div key={message.id} className={`chat ${mine ? "chat-end" : "chat-start"}`}>
                        <div className="chat-header">
                          {message.author}
                          <time className="ml-2 text-xs opacity-50" title={formatDate(message.createdAt)}>
                            {formatRelative(message.createdAt)}
                          </time>
                        </div>
                        <div className={`chat-bubble ${mine ? "chat-bubble-primary" : "chat-bubble-secondary"}`}>
                          {message.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleChatSubmit}>
                <textarea
                  className="textarea textarea-bordered h-24"
                  placeholder={
                    connectionState === "connected"
                      ? "Votre message..."
                      : "Connexion au serveur en cours..."
                  }
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  disabled={connectionState !== "connected" || sendingChat}
                  aria-label="Message à envoyer"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={connectionState !== "connected" || sendingChat || !chatInput.trim()}
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            </article>
          </div>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-base-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-base-content/60">Équipe</p>
                  <h2 className="text-lg font-semibold text-neutral">Participants</h2>
                </div>
                <span className="text-xs text-base-content/60">Mise à jour en direct</span>
              </header>
              <ul className="mt-4 space-y-3">
                {sortedParticipants.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-base-300/70 px-4 py-6 text-center text-sm text-base-content/60">
                    Aucun participant pour l’instant.
                  </li>
                ) : (
                  sortedParticipants.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex items-center justify-between rounded-2xl border border-base-200/70 bg-base-100/80 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-neutral">{participant.displayName}</p>
                        <p className="text-xs text-base-content/60">
                          {participant.isAdmin ? "Formateur" : participant.role}
                        </p>
                      </div>
                      <span
                        className={`badge rounded-full px-3 py-2 text-xs ${
                          participant.isConnected ? "badge-success" : "badge-ghost"
                        }`}
                      >
                        {participant.isConnected ? "En ligne" : "Hors ligne"}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </article>

            {isAdmin ? (
              <article className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-primary/90 to-secondary text-primary-content shadow-lg">
                <div className="space-y-4 p-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-content/70">
                      Formateur
                    </p>
                    <h2 className="text-lg font-semibold">Console d’injection</h2>
                  </div>
                  <p className="text-sm opacity-90">
                    Envoyez un événement ciblé à la salle. L’ensemble des participants recevra immédiatement la notification.
                  </p>
                  <form className="space-y-3" onSubmit={handleEventSubmit}>
                    <input
                      className="input input-bordered bg-white/10 text-primary-content placeholder:text-primary-content/70"
                      placeholder="Titre de l’événement"
                      value={eventTitle}
                      onChange={(event) => setEventTitle(event.target.value)}
                      disabled={connectionState !== "connected" || sendingEvent}
                      required
                    />
                    <textarea
                      className="textarea textarea-bordered h-28 bg-white/10 text-primary-content placeholder:text-primary-content/70"
                      placeholder="Description détaillée"
                      value={eventDescription}
                      onChange={(event) => setEventDescription(event.target.value)}
                      disabled={connectionState !== "connected" || sendingEvent}
                      required
                    />
                    <label className="form-control w-full max-w-xs">
                      <div className="label">
                        <span className="label-text text-primary-content">Sévérité</span>
                      </div>
                      <select
                        className="select select-bordered bg-white/10 text-primary-content"
                        value={eventSeverity}
                        onChange={(event) => setEventSeverity(event.target.value)}
                        disabled={connectionState !== "connected" || sendingEvent}
                      >
                        <option value="LOW">Faible</option>
                        <option value="MODERATE">Modérée</option>
                        <option value="HIGH">Élevée</option>
                        <option value="CRITICAL">Critique</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="btn btn-accent"
                      disabled={connectionState !== "connected" || sendingEvent}
                    >
                      Diffuser l’événement
                    </button>
                  </form>
                </div>
              </article>
            ) : null}
          </aside>
        </section>
      </div>
    </div>
  );
}
