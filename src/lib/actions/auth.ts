"use server";

export interface ActionState {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string>;
}

const DISABLED_MESSAGE =
  "L’authentification a été retirée de ParagonCrisis. Toutes les fonctionnalités sont accessibles sans compte.";

export async function loginAction(): Promise<ActionState> {
  return { error: DISABLED_MESSAGE };
}

export async function registerAction(): Promise<ActionState> {
  return { error: DISABLED_MESSAGE };
}

export async function updateProfileAction(): Promise<ActionState> {
  return { error: DISABLED_MESSAGE };
}

export async function logoutAction(): Promise<void> {
  // Rien à faire : aucune session n’est créée dans le mode public.
}

export async function getViewerRole(): Promise<null> {
  return null;
}
