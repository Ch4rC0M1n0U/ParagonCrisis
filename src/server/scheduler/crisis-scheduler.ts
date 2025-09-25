import { EventEmitter } from "node:events";

export interface ScheduledEventPayload {
  roomCode: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  triggeredAt: Date;
}

type SchedulerHandle = ReturnType<typeof setTimeout>;
type SchedulerMap = Map<string, SchedulerHandle>;

const schedulerEvents = new EventEmitter();
const activeSchedulers: SchedulerMap = new Map();

function randomBetween(minMs: number, maxMs: number) {
  const min = Math.ceil(minMs);
  const max = Math.floor(maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function onScheduledEvent(listener: (payload: ScheduledEventPayload) => void) {
  schedulerEvents.on("event", listener);
  return () => schedulerEvents.off("event", listener);
}

export function startRoomScheduler(roomCode: string) {
  if (activeSchedulers.has(roomCode)) {
    return;
  }

  const intervalMs = randomBetween(15_000, 30_000);

  const timeout: SchedulerHandle = setTimeout(function tick() {
    const severityOptions: ScheduledEventPayload["severity"][] = [
      "LOW",
      "MODERATE",
      "HIGH",
    ];
    const severity = severityOptions[Math.floor(Math.random() * severityOptions.length)];

    schedulerEvents.emit("event", {
      roomCode,
      severity,
      title: `Événement aléatoire (${severity})`,
      description: "Placeholder – brancher le générateur métier.",
      triggeredAt: new Date(),
    } satisfies ScheduledEventPayload);

    const nextInterval = randomBetween(15_000, 30_000);
    activeSchedulers.set(roomCode, setTimeout(tick, nextInterval));
  }, intervalMs);

  activeSchedulers.set(roomCode, timeout);
}

export function stopRoomScheduler(roomCode: string) {
  const scheduler = activeSchedulers.get(roomCode);
  if (scheduler) {
    clearTimeout(scheduler);
    activeSchedulers.delete(roomCode);
  }
}

export function stopAllSchedulers() {
  for (const [roomCode, timeout] of activeSchedulers.entries()) {
    clearTimeout(timeout);
    activeSchedulers.delete(roomCode);
  }
}

export function listActiveSchedulers() {
  return Array.from(activeSchedulers.keys());
}
