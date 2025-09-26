import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoomClient } from "@/components/room/room-client";

type SearchParams = Record<string, string | string[] | undefined>;

interface RoomPageProps {
  params: Promise<{ code: string }>;
  searchParams?: Promise<SearchParams>;
}

export const dynamic = "force-dynamic";

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = (searchParams ? await searchParams : {}) as SearchParams;

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

  const crisisContext = room
    ? {
        crisisType: room.crisisType ?? null,
        incidentAt: room.incidentAt ? room.incidentAt.toISOString() : null,
        locationName: room.locationName ?? null,
        addressLine: room.addressLine ?? null,
        postalCode: room.postalCode ?? null,
        city: room.city ?? null,
        country: room.country ?? null,
        latitude: typeof room.latitude === "number" ? room.latitude : null,
        longitude: typeof room.longitude === "number" ? room.longitude : null,
        contextNotes: room.contextNotes ?? null,
      }
    : null;

  return (
    <RoomClient
      roomCode={code}
      displayName={displayName}
      isAdmin={isAdmin}
      roomTitle={room?.title ?? null}
      roomExists={Boolean(room)}
      initialParticipants={initialParticipants}
      initialMessages={initialMessages}
      initialEvents={initialEvents}
      crisisContext={crisisContext}
    />
  );
}
