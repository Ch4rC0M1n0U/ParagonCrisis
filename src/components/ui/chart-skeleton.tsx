import type { ReactNode } from "react";

export interface ChartSkeletonProps {
  values: number[];
  labels: string[];
  max?: number;
  className?: string;
  barClassName?: string;
  footer?: ReactNode;
}

export function ChartSkeleton(props: ChartSkeletonProps) {
  const { values, labels, max, className, barClassName, footer } = props;
  const maxValue = max ?? Math.max(...values, 1);

  const containerClass =
    className ??
    "flex h-48 w-full items-end justify-between gap-3 rounded-2xl bg-gradient-to-tr from-primary/5 via-white to-secondary/10 px-6 pb-6";

  return (
    <div className="space-y-4">
      <div className={containerClass}>
        {values.map((value, index) => {
          const height = Math.max(18, Math.round((value / maxValue) * 100));
          return (
            <div key={labels[index]} className="flex flex-1 flex-col items-center gap-3">
              <div className="flex h-full w-full items-end justify-center">
                <div
                  className={barClassName ?? "w-full rounded-t-2xl bg-primary/70 shadow-sm"}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-base-content/60">
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
      {footer ? <div className="text-sm text-base-content/70">{footer}</div> : null}
    </div>
  );
}
