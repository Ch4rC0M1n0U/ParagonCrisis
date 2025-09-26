"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

interface CrisisContextSnapshot {
  crisisType: string | null;
  incidentAt: string | null;
  locationName: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  contextNotes: string | null;
}

interface FormState {
  title: string;
  crisisType: string;
  incidentAt: string;
  locationName: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  contextNotes: string;
}

interface RoomMetadataEditorProps {
  roomCode: string;
  initialTitle: string | null;
  initialContext: CrisisContextSnapshot | null;
  onUpdated?: (payload: {
    title: string | null;
    crisisContext: CrisisContextSnapshot;
  }) => void;
}

interface EditorStatus {
  type: "idle" | "success" | "error";
  message?: string;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

function buildFormState(title: string | null, context: CrisisContextSnapshot | null): FormState {
  return {
    title: title ?? "",
    crisisType: context?.crisisType ?? "",
    incidentAt: isoToLocalInput(context?.incidentAt ?? null),
    locationName: context?.locationName ?? "",
    addressLine: context?.addressLine ?? "",
    postalCode: context?.postalCode ?? "",
    city: context?.city ?? "",
    country: context?.country ?? "",
    latitude:
      typeof context?.latitude === "number" && Number.isFinite(context.latitude)
        ? context.latitude.toString()
        : "",
    longitude:
      typeof context?.longitude === "number" && Number.isFinite(context.longitude)
        ? context.longitude.toString()
        : "",
    contextNotes: context?.contextNotes ?? "",
  };
}

function parseCoordinate(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalised = trimmed.replace(/,/g, ".");
  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed)) {
    return "invalid";
  }
  return parsed;
}

export function RoomMetadataEditor({ roomCode, initialTitle, initialContext, onUpdated }: RoomMetadataEditorProps) {
  const [form, setForm] = useState<FormState>(() => buildFormState(initialTitle, initialContext));
  const [baseline, setBaseline] = useState<FormState>(() => buildFormState(initialTitle, initialContext));
  const [status, setStatus] = useState<EditorStatus>({ type: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const next = buildFormState(initialTitle, initialContext);
    setForm(next);
    setBaseline(next);
  }, [initialTitle, initialContext]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  const handleFieldChange = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, contextNotes: value }));
  };

  const handleReset = () => {
    setForm(baseline);
    setStatus({ type: "idle" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || isSubmitting) {
      return;
    }

    setStatus({ type: "idle" });

    const incidentAtIso = form.incidentAt ? new Date(form.incidentAt) : null;
    if (incidentAtIso && Number.isNaN(incidentAtIso.getTime())) {
      setStatus({ type: "error", message: "Format de date invalide." });
      return;
    }

    const latitudeValue = parseCoordinate(form.latitude);
    if (latitudeValue === "invalid") {
      setStatus({ type: "error", message: "Latitude invalide." });
      return;
    }

    const longitudeValue = parseCoordinate(form.longitude);
    if (longitudeValue === "invalid") {
      setStatus({ type: "error", message: "Longitude invalide." });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: form.title.trim() || null,
      crisisType: form.crisisType.trim() || null,
      incidentAt: incidentAtIso ? incidentAtIso.toISOString() : null,
      locationName: form.locationName.trim() || null,
      addressLine: form.addressLine.trim() || null,
      postalCode: form.postalCode.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      latitude: latitudeValue,
      longitude: longitudeValue,
      contextNotes: form.contextNotes.trim() ? form.contextNotes.trim() : null,
    };

    try {
      const response = await fetch(`/api/rooms/${roomCode}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ error: "Réponse JSON invalide." }));

      if (!response.ok) {
        const message = typeof data?.error === "string" ? data.error : "Impossible de mettre à jour la salle.";
        setStatus({ type: "error", message });
        return;
      }

      const nextContext: CrisisContextSnapshot = data.room?.crisisContext ?? {
        crisisType: payload.crisisType,
        incidentAt: payload.incidentAt,
        locationName: payload.locationName,
        addressLine: payload.addressLine,
        postalCode: payload.postalCode,
        city: payload.city,
        country: payload.country,
        latitude: payload.latitude,
        longitude: payload.longitude,
        contextNotes: payload.contextNotes,
      };

      const nextTitle: string | null = data.room?.title ?? payload.title;
      const nextForm = buildFormState(nextTitle, nextContext);
      setBaseline(nextForm);
      setForm(nextForm);
      setStatus({ type: "success", message: "Briefing mis à jour." });
      onUpdated?.({
        title: nextTitle,
        crisisContext: nextContext,
      });
    } catch {
      setStatus({ type: "error", message: "Erreur réseau inattendue." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-primary/30 bg-white/90 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Configuration</p>
          <h2 className="text-xl font-semibold text-neutral">Briefing formateur – Métadonnées</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Ajustez le contexte de crise pour alimenter le briefing automatique affiché à l’équipe.
          </p>
        </div>
        {status.type === "success" ? (
          <span className="badge badge-success badge-outline border-success/40 bg-success/10 text-success">
            {status.message}
          </span>
        ) : status.type === "error" && status.message ? (
          <span className="badge badge-error badge-outline border-error/40 bg-error/10 text-error">
            {status.message}
          </span>
        ) : null}
      </header>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Titre de la salle</span>
              <span className="label-text-alt text-xs text-base-content/60">* requis pour le briefing</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.title}
              onChange={handleFieldChange("title")}
              placeholder="Ex. Exercice cyber – Hôpital St-Michel"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Type de crise</span>
              <span className="label-text-alt text-xs text-base-content/60">Ex. Cyber, explosion, inondation…</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.crisisType}
              onChange={handleFieldChange("crisisType")}
              placeholder="Cyberattaque"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Date et heure de l’incident</span>
              <span className="label-text-alt text-xs text-base-content/60">Heure locale</span>
            </div>
            <input
              type="datetime-local"
              className="input input-bordered"
              value={form.incidentAt}
              onChange={handleFieldChange("incidentAt")}
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Nom du site</span>
              <span className="label-text-alt text-xs text-base-content/60">Ex. Campus Nord Bruxelles</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.locationName}
              onChange={handleFieldChange("locationName")}
            />
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="form-control w-full lg:col-span-2">
            <div className="label">
              <span className="label-text font-medium text-neutral">Adresse</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.addressLine}
              onChange={handleFieldChange("addressLine")}
              placeholder="Rue, numéro"
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Code postal</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.postalCode}
              onChange={handleFieldChange("postalCode")}
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Ville</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.city}
              onChange={handleFieldChange("city")}
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Pays</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.country}
              onChange={handleFieldChange("country")}
              placeholder="Belgique"
            />
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Latitude</span>
              <span className="label-text-alt text-xs text-base-content/60">Format décimal (ex. 50.8503)</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.latitude}
              onChange={handleFieldChange("latitude")}
            />
          </label>
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text font-medium text-neutral">Longitude</span>
              <span className="label-text-alt text-xs text-base-content/60">Format décimal (ex. 4.3517)</span>
            </div>
            <input
              type="text"
              className="input input-bordered"
              value={form.longitude}
              onChange={handleFieldChange("longitude")}
            />
          </label>
        </div>
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text font-medium text-neutral">Renseignement complémentaire</span>
            <span className="label-text-alt text-xs text-base-content/60">Partagez le contexte ou la consigne formateur</span>
          </div>
          <textarea
            name="contextNotes"
            className="textarea textarea-bordered h-32"
            placeholder="Ex. Contexte politique tendu, les médias sont déjà sur place..."
            value={form.contextNotes}
            onChange={handleNotesChange}
            maxLength={2000}
          />
          <div className="label justify-end">
            <span className="label-text-alt text-xs text-base-content/50">
              {form.contextNotes.length} / 2000
            </span>
          </div>
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleReset}
            disabled={!isDirty || isSubmitting}
          >
            Réinitialiser
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isDirty || isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </section>
  );
}
