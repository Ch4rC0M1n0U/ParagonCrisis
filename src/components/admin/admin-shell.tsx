import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { key: "dashboard", label: "Vue d'ensemble", href: "/admin", icon: "📊" },
  { key: "rooms", label: "Rooms", href: "/admin#rooms", icon: "🛰️" },
  { key: "scheduler", label: "Scheduler", href: "/admin#scheduler", icon: "⏱️" },
  { key: "reports", label: "Exports", href: "/admin#reports", icon: "📤" },
  { key: "settings", label: "Paramètres", href: "/admin#settings", icon: "⚙️" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

interface AdminShellProps {
  active: NavKey;
  children: ReactNode;
  gradientStyle?: CSSProperties;
}

function SecretBanner() {
  const hasSecret = Boolean(process.env.ADMIN_SECRET);

  return (
    <div
      className={`alert flex items-start gap-3 border ${hasSecret ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}
      role="status"
    >
      <span className="text-2xl" aria-hidden>
        {hasSecret ? "🔐" : "⚠️"}
      </span>
      <div>
        <h3 className="font-semibold">
          {hasSecret ? "ADMIN_SECRET détecté" : "ADMIN_SECRET non défini"}
        </h3>
        <p className="text-sm leading-relaxed text-base-content/70">
          {hasSecret
            ? "L’interface pourra valider les requêtes sécurisées vers le backend. Pensez à transmettre la clé aux formateurs de confiance."
            : "Ajoutez une clé ADMIN_SECRET dans votre fichier .env pour autoriser les actions critiques (injection d’événements, purge, exports)."}
        </p>
      </div>
    </div>
  );
}

const defaultGradient: CSSProperties = {
  background:
    "radial-gradient(circle at top left, rgba(15,157,138,0.16), transparent 45%), radial-gradient(circle at top right, rgba(11,85,96,0.18), transparent 40%)",
};

export function AdminShell({ active, children, gradientStyle }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-base-100" style={gradientStyle ?? defaultGradient}>
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-6 pb-16 pt-10 xl:px-10">
        <aside className="hidden w-64 shrink-0 flex-col rounded-3xl border border-base-200/80 bg-white/80 p-6 shadow-sm backdrop-blur lg:flex">
          <div className="mb-8 space-y-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/70">ParagonCrisis</span>
              <p className="text-lg font-semibold text-neutral">Command Center</p>
              <p className="text-xs text-base-content/60">Monitorer, piloter et analyser vos rooms de crise.</p>
            </div>
            <div className="rounded-2xl border border-base-200/80 bg-base-100/80 p-4 text-sm text-base-content/70">
              <p className="font-semibold text-neutral">Mode démonstration</p>
              <p>Accès libre aux outils formateur pour explorer la plateforme.</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 font-medium transition hover:bg-primary/5 ${
                  item.key === active ? "bg-primary/10 text-primary" : "text-base-content/70"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-4 pt-6">
            <SecretBanner />
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 p-4 text-sm text-base-content/70">
              <p className="font-semibold text-neutral">Besoin d’aide&nbsp;?</p>
              <p className="mt-1 text-xs">Consultez la base de connaissances ou contactez un formateur senior.</p>
              <Link href="mailto:support@paragoncrisis.io" className="btn btn-sm btn-primary mt-4 w-full">
                Contacter le support
              </Link>
            </div>
            <Link href="/" className="btn btn-sm btn-ghost w-full justify-between">
              <span>Revenir à l’accueil</span>
              <span aria-hidden>↩</span>
            </Link>
          </div>
        </aside>
        <main className="flex-1 space-y-10">{children}</main>
      </div>
    </div>
  );
}
