export interface RegistrationInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  matricule: string;
  service?: string | null;
}

export interface Credentials {
  login: string;
  password: string;
}

export interface ProfileUpdateInput {
  email: string;
  firstName: string;
  lastName: string;
  matricule: string;
  service?: string | null;
  newPassword?: string | null;
}

const DISABLED_ERROR =
  "Les comptes utilisateurs ne sont plus actifs sur ParagonCrisis. Toutes les fonctionnalités sont publiques.";

export async function createAccount(): Promise<never> {
  throw new Error(DISABLED_ERROR);
}

export async function authenticateUser(): Promise<never> {
  throw new Error(DISABLED_ERROR);
}

export async function createSession(): Promise<void> {}

export async function destroySession(): Promise<void> {}

export async function getCurrentUser() {
  return null;
}

export async function requireUser() {
  throw new Error(DISABLED_ERROR);
}

export async function requireFormateur() {
  throw new Error(DISABLED_ERROR);
}

export async function updateUserProfile(): Promise<never> {
  throw new Error(DISABLED_ERROR);
}

export function isFormateur(): boolean {
  return true;
}
