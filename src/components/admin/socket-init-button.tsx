"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface SocketInitButtonProps {
  className?: string;
  layout?: "inline" | "stack";
}

export function SocketInitButton({ className = "", layout = "stack" }: SocketInitButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/socket", {
        method: "GET",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      if (!response.ok) {
        throw new Error(`Requête échouée (${response.status})`);
      }

      setStatus("success");
      setMessage("Socket initialisé avec succès.");
    } catch (error) {
      console.error("Impossible d'initialiser le socket:", error);
      setStatus("error");
      setMessage("Erreur lors de l'initialisation du socket.");
    }
  };

  const icon = status === "loading" ? "⏳" : status === "success" ? "✅" : status === "error" ? "⚠️" : "🛰️";
  const buttonText = status === "loading" ? "Initialisation…" : "Initialiser Socket";
  const baseButtonClass = "btn btn-outline btn-sm gap-2 transition-shadow";
  const composedButtonClass = `${baseButtonClass}${className ? ` ${className}` : ""}`;
  const success = status === "success";
  const error = status === "error";
  const wrapperClass = layout === "inline" ? "flex items-center gap-2" : "flex flex-col items-start gap-1";

  return (
    <div className={wrapperClass}>
      <button type="button" onClick={handleClick} className={composedButtonClass} disabled={status === "loading"}>
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <span>{buttonText}</span>
      </button>
      {message && (
        <span
          className={`text-xs font-medium ${
            success ? "text-success" : error ? "text-error" : "text-base-content/60"
          }`}
          role="status"
        >
          {message}
        </span>
      )}
    </div>
  );
}
