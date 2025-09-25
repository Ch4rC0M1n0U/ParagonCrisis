"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  return Array.from({ length }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
}

type Variant = "create" | "join";

interface RoomAccessFormProps {
  variant: Variant;
}

export function RoomAccessForm({ variant }: RoomAccessFormProps) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState(
    variant === "create" ? generateCode() : ""
  );
  const [displayName, setDisplayName] = useState(
    variant === "create" ? "Formateur" : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (variant === "create" ? "Créer une nouvelle salle" : "Rejoindre une salle"),
    [variant]
  );

  const description =
    variant === "create"
      ? "Générez un code unique et partagez-le avec vos participants."
      : "Saisissez le code reçu et votre nom pour rejoindre la simulation.";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roomCode.trim()) {
      setError("Le code de salle est requis.");
      return;
    }

    if (!displayName.trim()) {
      setError("Merci d’indiquer un nom ou un indicatif.");
      return;
    }

    setError(null);
    setPending(true);

    const baseUrl = `/room/${roomCode.trim().toUpperCase()}`;
    const params = new URLSearchParams({ name: displayName.trim() });

    if (variant === "create") {
      params.set("admin", "1");
    }

    router.push(`${baseUrl}?${params.toString()}`);
  }

  function handleGenerateCode() {
    setRoomCode(generateCode());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-base-content/90">{title}</h3>
        <p className="text-sm text-base-content/70">{description}</p>
      </div>

      <div className="form-control gap-2">
        <label className="label" htmlFor={`${variant}-room-code`}>
          <span className="label-text">Code de salle</span>
        </label>
        <div className="flex gap-2">
          <input
            id={`${variant}-room-code`}
            className="input input-bordered input-primary uppercase flex-1"
            placeholder="EX: CRISIS4"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.replace(/[^A-Z0-9]/gi, ""))}
            maxLength={8}
            autoComplete="off"
            required
            aria-describedby={`${variant}-room-code-helper`}
            disabled={pending}
          />
          {variant === "create" ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleGenerateCode}
              disabled={pending}
            >
              Générer
            </button>
          ) : null}
        </div>
        <span
          id={`${variant}-room-code-helper`}
          className="text-xs text-base-content/70"
        >
          Utilisez 4 à 8 caractères alphanumériques.
        </span>
      </div>

      <div className="form-control gap-2">
        <label className="label" htmlFor={`${variant}-name`}>
          <span className="label-text">
            {variant === "create" ? "Nom du formateur" : "Votre nom"}
          </span>
        </label>
        <input
          id={`${variant}-name`}
          className="input input-bordered"
          placeholder={variant === "create" ? "Ex: Formateur" : "Ex: Alice"}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={32}
          autoComplete="off"
          required
          disabled={pending}
        />
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {variant === "create" ? "Entrer dans la salle" : "Rejoindre"}
        </button>
      </div>
    </form>
  );
}
