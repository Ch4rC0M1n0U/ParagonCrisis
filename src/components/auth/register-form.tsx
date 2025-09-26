"use client";

import Link from "next/link";

export function RegisterForm() {
  return (
    <div className="card card-bordered border-base-200/70 bg-base-100/90 shadow-xl">
      <div className="card-body space-y-6 text-center">
        <h1 className="text-3xl font-semibold text-neutral">Inscription suspendue</h1>
        <p className="text-sm text-base-content/70">
          Les comptes utilisateurs ne sont plus nécessaires pour profiter de ParagonCrisis. Explorez les rooms publiques
          et pilotez vos simulations sans créer de profil.
        </p>
        <Link href="/" className="btn btn-primary">
          Découvrir la plateforme
        </Link>
      </div>
    </div>
  );
}
