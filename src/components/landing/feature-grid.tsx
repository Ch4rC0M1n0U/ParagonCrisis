const features = [
  {
    title: "Messages et événements",
    description:
      "Injectez des incidents critiques, documents et consignes en direct pour challenger l'équipe.",
    icon: "🗞️",
  },
  {
    title: "Événements automatiques",
    description:
      "Alimentez le bruit opérationnel grâce au scheduler probabiliste toutes les 15–30 secondes.",
    icon: "🎲",
  },
  {
    title: "Alertes sonores",
    description:
      "Déclenchez des signaux audio pour créer une pression supplémentaire lors des crises.",
    icon: "🚨",
  },
  {
    title: "Salle unique",
    description:
      "Accédez rapidement à une room via URL dédiée et code court à partager.",
    icon: "🔑",
  },
];

export function FeatureGrid() {
  return (
    <section className="grid gap-5 md:grid-cols-2">
      {features.map((feature) => (
        <article
          key={feature.title}
          className="group rounded-3xl border border-base-200/70 bg-white/90 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden>
              {feature.icon}
            </span>
            <h3 className="text-lg font-semibold text-neutral">{feature.title}</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-base-content/70">
            {feature.description}
          </p>
          <div className="mt-4 h-1 w-12 rounded-full bg-primary/40 transition group-hover:bg-primary" />
        </article>
      ))}
    </section>
  );
}
