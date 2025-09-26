export const metadata = {
  title: "Mon profil | ParagonCrisis",
};
export default function ProfilePage() {
  return (
  <section className="mx-auto flex w-full max-w-3xl md:max-w-[85vw] flex-col gap-6 px-6 py-16 text-base-content/80">
      <h1 className="text-4xl font-semibold text-neutral">Profils désactivés</h1>
      <p>
        L’espace profil personnel a été retiré dans la version actuelle de ParagonCrisis afin de proposer un accès
        entièrement public et centré sur les rooms de simulation. Toutes les actions (création de rooms, suivi des
        événements, exports) se pilotent désormais depuis l’interface formateur accessible librement.
      </p>
      <p>
        Besoin d’un suivi personnalisé ou d’une restauration de comptes&nbsp;? Envoyez-nous un message à
        <span className="font-semibold"> support@paragoncrisis.io</span> et l’équipe vous guidera.
      </p>
      <div className="alert border border-base-200/80 bg-base-100/90 shadow">
        <span aria-hidden>ℹ️</span>
        <div>
          <h2 className="font-semibold text-neutral">Conseil</h2>
          <p className="text-sm">
            Utilisez le tableau de bord formateur pour suivre l’activité des rooms en direct et exporter les rapports
            de simulation sans créer de compte.
          </p>
        </div>
      </div>
    </section>
  );
}
