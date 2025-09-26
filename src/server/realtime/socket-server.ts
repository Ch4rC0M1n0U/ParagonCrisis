import type { Server as HTTPServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  startRoomScheduler,
  stopRoomScheduler,
  onScheduledEvent,
} from "@/server/scheduler/crisis-scheduler";
import {
  MessageType,
  EventSource,
  CrisisSeverity,
} from "@/generated/prisma";

export type ServerToClientEvents = {
  "system:announcement": (payload: { message: string }) => void;
  "system:error": (payload: { message: string }) => void;
  "chat:message": (payload: {
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }) => void;
  "event:created": (payload: {
    id: string;
    title: string;
    description: string;
    severity: string;
    triggeredAt: string;
    source: string;
  }) => void;
  "participant:update": (payload: {
    participants: Array<{
      id: string;
      displayName: string;
      role: string;
      isAdmin: boolean;
      isConnected?: boolean;
      joinedAt?: string;
      leftAt?: string | null;
    }>;
  }) => void;
  "room:context:update": (payload: {
    code: string;
    title: string | null;
    crisisContext: {
      crisisType: string | null;
      incidentAt: string | null;
      locationName: string | null;
      addressLine: string | null;
      postalCode: string | null;
      city: string | null;
      country: string | null;
      latitude: number | null;
      longitude: number | null;
      contextNotes: string | null;
    };
  }) => void;
};

export type ClientToServerEvents = {
  "room:join": (payload: {
    roomCode: string;
    displayName: string;
    isAdmin?: boolean;
  }) => void;
  "room:leave": (payload: { roomCode: string }) => void;
  "chat:message": (payload: {
    roomCode: string;
    content: string;
  }) => void;
  "event:create": (payload: {
    roomCode: string;
    title: string;
    description: string;
    severity: string;
  }) => void;
  "event:ack": (payload: {
    eventId: string;
  }) => void;
};

type CrisisSocketData = {
  roomCode?: string;
  roomId?: string;
  participantId?: string;
  displayName?: string;
  isAdmin?: boolean;
};

type CrisisSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, unknown>, CrisisSocketData>;

type CrisisServer = IOServer<ClientToServerEvents, ServerToClientEvents, Record<string, unknown>, CrisisSocketData>;

let io: CrisisServer | undefined;
const roomConnections = new Map<string, Set<string>>();
let unsubscribeScheduler: (() => void) | null = null;

export function createSocketServer(httpServer: HTTPServer) {
  if (io) {
    return io;
  }

  io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.NEXT_PUBLIC_WS_URL ?? "*",
    },
    serveClient: false,
    path: "/api/socket",
  });

  registerBaseHandlers(io);
  subscribeToScheduler(io);
  return io;
}

export function getSocketServer(): CrisisServer {
  if (!io) {
    throw new Error("Socket.IO non initialisé – appelez createSocketServer côté serveur.");
  }
  return io;
}

function registerBaseHandlers(server: CrisisServer) {
  server.on("connection", (socket: CrisisSocket) => {
    socket.on(
      "room:join",
      async ({ roomCode, displayName, isAdmin }: Parameters<ClientToServerEvents["room:join"]>[0]) => {
        await handleJoin(server, socket, roomCode, displayName, Boolean(isAdmin));
      },
    );

    socket.on(
      "room:leave",
      async ({ roomCode }: Parameters<ClientToServerEvents["room:leave"]>[0]) => {
        await handleLeave(server, socket, roomCode);
      },
    );

    socket.on("chat:message", async (payload) => {
      await handleChatMessage(server, socket, payload);
    });

    socket.on("event:create", async (payload) => {
      await handleManualEvent(server, socket, payload);
    });

    socket.on("event:ack", async ({ eventId }) => {
      await prisma.crisisEvent.updateMany({
        where: { id: eventId },
        data: { ackAt: new Date() },
      });
    });

    socket.on("disconnect", async () => {
      if (!socket.data.roomCode) {
        return;
      }
      await handleLeave(server, socket, socket.data.roomCode);
    });
  });
}

function subscribeToScheduler(server: CrisisServer) {
  if (unsubscribeScheduler) {
    return;
  }

  unsubscribeScheduler = onScheduledEvent(async (event) => {
    const roomCode = event.roomCode.toUpperCase();
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
      return;
    }

    const severityKey = event.severity.toUpperCase() as keyof typeof CrisisSeverity;
    if (!Object.prototype.hasOwnProperty.call(CrisisSeverity, severityKey)) {
      return;
    }

    const severityValue = CrisisSeverity[severityKey];

    const crisisEvent = await prisma.crisisEvent.create({
      data: {
        roomId: room.id,
        title: event.title,
        description: event.description,
        severity: severityValue,
        source: EventSource.SCHEDULER,
        triggeredAt: event.triggeredAt,
      },
    });

    await prisma.message.create({
      data: {
        roomId: room.id,
        authorName: "Scheduler",
        type: MessageType.EVENT,
        content: `${event.title} – ${event.description}`,
        metadata: {
          severity: event.severity,
          source: EventSource.SCHEDULER,
        },
      },
    });

    server.to(roomCode).emit("event:created", {
      id: crisisEvent.id,
      title: crisisEvent.title,
      description: crisisEvent.description,
      severity: crisisEvent.severity,
      source: crisisEvent.source,
      triggeredAt: crisisEvent.triggeredAt.toISOString(),
    });

    server.to(roomCode).emit("system:announcement", {
      message: `Événement automatique ${crisisEvent.severity.toLowerCase()} déclenché : ${crisisEvent.title}`,
    });
  });
}

async function handleJoin(
  server: CrisisServer,
  socket: CrisisSocket,
  roomCode: string,
  displayName: string,
  isAdmin: boolean,
) {
  const normalizedCode = roomCode.toUpperCase();
  let room = await prisma.room.findUnique({ where: { code: normalizedCode } });

  if (!room) {
    if (!isAdmin) {
      socket.emit("system:error", {
        message: `La salle ${normalizedCode} n’existe pas encore. Demandez au formateur de la créer.`,
      });
      return;
    }

    room = await prisma.room.create({
      data: {
        code: normalizedCode,
        title: `Salle ${normalizedCode}`,
        isActive: true,
      },
    });
  }

  const existingParticipant = await prisma.participant.findFirst({
    where: { roomId: room.id, displayName },
  });

  const participant = existingParticipant
    ? await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: {
          isConnected: true,
          leftAt: null,
          role: isAdmin ? "formateur" : existingParticipant.role,
        },
      })
    : await prisma.participant.create({
        data: {
          roomId: room.id,
          displayName,
          role: isAdmin ? "formateur" : "participant",
          isConnected: true,
        },
      });

  socket.join(normalizedCode);
  socket.data.roomCode = normalizedCode;
  socket.data.roomId = room.id;
  socket.data.participantId = participant.id;
  socket.data.displayName = participant.displayName;
  socket.data.isAdmin = isAdmin;

  const connections = roomConnections.get(normalizedCode) ?? new Set<string>();
  connections.add(socket.id);
  roomConnections.set(normalizedCode, connections);

  if (isAdmin) {
    startRoomScheduler(normalizedCode);
  }

  await broadcastParticipants(server, normalizedCode, room.id);

  server.to(normalizedCode).emit("system:announcement", {
    message: `${participant.displayName} a rejoint la salle${isAdmin ? " (formateur)" : ""}.`,
  });
}

async function handleLeave(server: CrisisServer, socket: CrisisSocket, roomCode: string) {
  const normalizedCode = roomCode.toUpperCase();
  const participantId = socket.data.participantId;
  const roomId = socket.data.roomId;

  socket.leave(normalizedCode);

  if (participantId) {
    await prisma.participant.updateMany({
      where: { id: participantId },
      data: { isConnected: false, leftAt: new Date() },
    });
  }

  const connections = roomConnections.get(normalizedCode);
  if (connections) {
    connections.delete(socket.id);
    if (connections.size === 0) {
      roomConnections.delete(normalizedCode);
      stopRoomScheduler(normalizedCode);
    }
  }

  if (roomId) {
    await broadcastParticipants(server, normalizedCode, roomId);
  }

  if (socket.data.displayName) {
    server.to(normalizedCode).emit("system:announcement", {
      message: `${socket.data.displayName} a quitté la salle.`,
    });
  }
}

async function handleChatMessage(
  server: CrisisServer,
  socket: CrisisSocket,
  payload: Parameters<ClientToServerEvents["chat:message"]>[0],
) {
  const { roomId, displayName, roomCode } = socket.data;
  if (!roomId || !roomCode) {
    socket.emit("system:error", { message: "Impossible d’identifier la salle courante." });
    return;
  }

  const content = payload.content.trim();
  if (!content) {
    return;
  }

  const message = await prisma.message.create({
    data: {
      roomId,
      authorName: displayName,
      type: MessageType.CHAT,
      content,
    },
  });

  server.to(roomCode).emit("chat:message", {
    id: message.id,
    author: message.authorName ?? "Anonyme",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
}

async function handleManualEvent(
  server: CrisisServer,
  socket: CrisisSocket,
  payload: Parameters<ClientToServerEvents["event:create"]>[0],
) {
  if (!socket.data.isAdmin) {
    socket.emit("system:error", {
      message: "Seul un formateur peut injecter un événement.",
    });
    return;
  }

  const { roomId, roomCode } = socket.data;
  if (!roomId || !roomCode) {
    socket.emit("system:error", { message: "Salle introuvable côté serveur." });
    return;
  }

  const normalizedSeverity = payload.severity.toUpperCase() as keyof typeof CrisisSeverity;
  if (!Object.prototype.hasOwnProperty.call(CrisisSeverity, normalizedSeverity)) {
    socket.emit("system:error", { message: "Sévérité invalide pour l’événement." });
    return;
  }

  const crisisEvent = await prisma.crisisEvent.create({
    data: {
      roomId,
      title: payload.title,
      description: payload.description,
      severity: CrisisSeverity[normalizedSeverity],
      source: EventSource.MANUAL,
    },
  });

  await prisma.message.create({
    data: {
      roomId,
      authorName: socket.data.displayName ?? "Formateur",
      type: MessageType.EVENT,
      content: payload.description,
      metadata: {
        severity: normalizedSeverity,
        source: EventSource.MANUAL,
      },
    },
  });

  server.to(roomCode).emit("event:created", {
    id: crisisEvent.id,
    title: crisisEvent.title,
    description: crisisEvent.description,
    severity: crisisEvent.severity,
    source: crisisEvent.source,
    triggeredAt: crisisEvent.triggeredAt.toISOString(),
  });

  server.to(roomCode).emit("system:announcement", {
    message: `Injection formateur : ${crisisEvent.title}`,
  });
}

async function broadcastParticipants(server: CrisisServer, roomCode: string, roomId: string) {
  const participants = await prisma.participant.findMany({
    where: { roomId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      displayName: true,
      role: true,
      isConnected: true,
      joinedAt: true,
      leftAt: true,
    },
  });

  server.to(roomCode).emit("participant:update", {
    participants: participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      role: participant.role ?? "participant",
      isAdmin: (participant.role ?? "participant").toLowerCase() === "formateur",
      isConnected: participant.isConnected,
      joinedAt: participant.joinedAt.toISOString(),
      leftAt: participant.leftAt ? participant.leftAt.toISOString() : null,
    })),
  });
}
