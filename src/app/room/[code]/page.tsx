import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoomClient } from "@/components/room/room-client";

type MaybePromise<T> = T | Promise<T>;

interface RoomPageProps {
  params: MaybePromise<{ code: string }>;
  searchParams: MaybePromise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const code = resolvedParams.code.toUpperCase();

  const displayName =
    typeof resolvedSearchParams.name === "string" && resolvedSearchParams.name.trim().length > 0
      ? resolvedSearchParams.name.trim()
      : "Invité";

  const rawAdmin = resolvedSearchParams.admin;
  const adminToken = Array.isArray(rawAdmin) ? rawAdmin[0] : rawAdmin;
  const isAdmin = Boolean(adminToken && adminToken !== "0" && adminToken !== "false");

  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      participants: {
        orderBy: { joinedAt: "asc" },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
      crisisEvents: {
        orderBy: { triggeredAt: "desc" },
        take: 100,
      },
    },
  });

  if (!room && !isAdmin) {
    // Pour un participant, afficher une 404 si la salle n'existe pas.
    notFound();
  }

  const initialParticipants = (room?.participants ?? []).map((participant) => ({
    id: participant.id,
    displayName: participant.displayName,
    role: participant.role ?? "participant",
    isConnected: participant.isConnected,
    isAdmin: (participant.role ?? "participant").toLowerCase() === "formateur",
    joinedAt: participant.joinedAt.toISOString(),
    leftAt: participant.leftAt ? participant.leftAt.toISOString() : null,
  }));

  const initialMessages = (room?.messages ?? []).map((message) => ({
    id: message.id,
    author: message.authorName ?? "Système",
    type: message.type,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }));

  const initialEvents = (room?.crisisEvents ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    severity: event.severity,
    source: event.source,
    triggeredAt: event.triggeredAt.toISOString(),
    ackAt: event.ackAt ? event.ackAt.toISOString() : null,
  }));

  return (
    <RoomClient
      roomCode={code}
      displayName={displayName}
      isAdmin={isAdmin}
      roomTitle={room?.title ?? `Salle ${code}`}
      roomExists={Boolean(room)}
      initialParticipants={initialParticipants}
      initialMessages={initialMessages}
      initialEvents={initialEvents}
    />
  );
}
