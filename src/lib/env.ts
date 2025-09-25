import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL est requis pour initialiser Prisma"),
  ADMIN_SECRET: z
    .string()
    .min(8, "ADMIN_SECRET doit comporter au moins 8 caractères")
    .optional(),
  NEXT_PUBLIC_WS_URL: z
    .string()
    .url("NEXT_PUBLIC_WS_URL doit être une URL valide")
    .optional(),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
});

if (!parsed.success) {
  console.error("Erreur de configuration des variables d'environnement", parsed.error.flatten().fieldErrors);
  throw new Error("Variables d'environnement invalides. Consultez env.ts pour les exigences.");
}

export const env = parsed.data;
