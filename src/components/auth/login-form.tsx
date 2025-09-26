"use client";

import Link from "next/link";

export function LoginForm() {
  return (
    <div className="card card-bordered border-base-200/70 bg-base-100/90 shadow-xl">
      <div className="card-body space-y-6 text-center">
        <h1 className="text-3xl font-semibold text-neutral">Authentification désactivée</h1>
        <p className="text-sm text-base-content/70">
          La plateforme ParagonCrisis est désormais accessible sans compte. Utilisez l’accueil public et le tableau de
          bord formateur pour créer et piloter vos rooms.
        </p>
        <Link href="/" className="btn btn-primary">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
