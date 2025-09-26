import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSocketServer } from "@/server/realtime/socket-server";

const optionalString = (min: number, max: number) =>
  z
    .preprocess((value) => {
      if (value === undefined) {
        return undefined;
      }
      if (value === null) {
        return null;
      }
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }, z.string().min(min).max(max))
    .nullable()
    .optional();

const optionalLatitude = z
  .preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === "") {
      return null;
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  }, z.number().min(-90).max(90))
  .nullable()
  .optional();

const optionalLongitude = z
  .preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === "") {
      return null;
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  }, z.number().min(-180).max(180))
  .nullable()
  .optional();

const optionalDate = z
  .preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === "") {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed;
    }
    return value;
  }, z.date())
  .nullable()
  .optional();

const payloadSchema = z.object({
  title: optionalString(1, 160),
  crisisType: optionalString(2, 120),
  incidentAt: optionalDate,
  locationName: optionalString(2, 160),
  addressLine: optionalString(2, 180),
  postalCode: optionalString(2, 20),
  city: optionalString(2, 160),
  country: optionalString(2, 160),
  latitude: optionalLatitude,
  longitude: optionalLongitude,
  contextNotes: optionalString(4, 2000),
});

function serialiseRoom(room: Awaited<ReturnType<typeof prisma.room.update>>) {
  return {
    code: room.code,
    title: room.title ?? null,
    crisisContext: {
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
    },
  } as const;
}

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const resolvedParams = await context.params;
  const rawCode = resolvedParams.code;

  if (!rawCode || typeof rawCode !== "string") {
    return NextResponse.json({ error: "Code de salle manquant." }, { status: 400 });
  }

  const roomCode = rawCode.toUpperCase();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Champs invalides.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existingRoom = await prisma.room.findUnique({ where: { code: roomCode } });
  if (!existingRoom) {
    return NextResponse.json({ error: "Salle introuvable." }, { status: 404 });
  }

  const updateData: Prisma.RoomUncheckedUpdateInput = {};

  if (parsed.data.title !== undefined) {
    updateData.title = parsed.data.title;
  }
  if (parsed.data.crisisType !== undefined) {
    updateData.crisisType = parsed.data.crisisType;
  }
  if (parsed.data.incidentAt !== undefined) {
    updateData.incidentAt = parsed.data.incidentAt;
  }
  if (parsed.data.locationName !== undefined) {
    updateData.locationName = parsed.data.locationName;
  }
  if (parsed.data.addressLine !== undefined) {
    updateData.addressLine = parsed.data.addressLine;
  }
  if (parsed.data.postalCode !== undefined) {
    updateData.postalCode = parsed.data.postalCode;
  }
  if (parsed.data.city !== undefined) {
    updateData.city = parsed.data.city;
  }
  if (parsed.data.country !== undefined) {
    updateData.country = parsed.data.country;
  }
  if (parsed.data.latitude !== undefined) {
    updateData.latitude = parsed.data.latitude;
  }
  if (parsed.data.longitude !== undefined) {
    updateData.longitude = parsed.data.longitude;
  }
  if (parsed.data.contextNotes !== undefined) {
    updateData.contextNotes = parsed.data.contextNotes;
  }

  const updatedRoom = await prisma.room.update({
    where: { code: roomCode },
    data: updateData,
  });

  const serialised = serialiseRoom(updatedRoom);

  try {
    const io = getSocketServer();
    io.to(roomCode).emit("room:context:update", {
      code: serialised.code,
      title: serialised.title,
      crisisContext: serialised.crisisContext,
    });
  } catch (error) {
    console.warn("Impossible d'émettre la mise à jour du contexte :", error);
  }

  revalidatePath(`/room/${roomCode}`);
  revalidatePath("/admin");

  return NextResponse.json({ room: serialised });
}
