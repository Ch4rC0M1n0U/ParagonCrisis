export function ProfileForm() {
  return (
    <div className="card card-bordered border-base-200/70 bg-base-100/90 shadow-xl">
      <div className="card-body space-y-6 text-center">
        <h1 className="text-3xl font-semibold text-neutral">Gestion de profil désactivée</h1>
        <p className="text-sm text-base-content/70">
          La gestion des informations personnelles et des mots de passe n’est plus proposée. ParagonCrisis fonctionne
          désormais sans authentification : les rooms et le tableau de bord formateur sont accessibles librement.
        </p>
      </div>
    </div>
  );
}
