import type { ReactNode } from "react";

export type MetricDeltaTone = "up" | "down" | "neutral";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: ReactNode;
  deltaTone?: MetricDeltaTone;
  accentClassName?: string;
  className?: string;
}

export function MetricCard(props: MetricCardProps) {
  const {
    label,
    value,
    hint,
    delta,
    deltaTone = "up",
    accentClassName = "bg-primary/40",
    className,
  } = props;

  const baseClass = "rounded-3xl border border-base-200/70 bg-white/70 p-5 shadow-sm backdrop-blur";
  const wrapperClass = className ? `${baseClass} ${className}` : baseClass;

  const toneClass =
    deltaTone === "up"
      ? "bg-success/10 text-success"
      : deltaTone === "down"
        ? "bg-error/10 text-error"
        : "bg-base-200 text-base-content/70";

  return (
    <article className={wrapperClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-base-content/60">
            {label}
          </span>
          <div className="text-3xl font-semibold text-neutral">{value}</div>
        </div>
        {delta ? (
          <span className={`badge badge-sm rounded-full border-0 px-3 py-2 font-medium ${toneClass}`}>
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-4 text-xs font-medium text-base-content/60">{hint}</p> : null}
      <div className={`mt-5 h-1.5 w-14 rounded-full ${accentClassName}`} />
    </article>
  );
}
