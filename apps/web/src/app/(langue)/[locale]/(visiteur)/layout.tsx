import { BarreDuBas } from "@/components/layout/barre-du-bas";
import { PiedDePage } from "@/components/layout/pied-de-page";
import { estLangue } from "@/lib/i18n/langues";
import { attendUneAction, listerDemandes } from "@/mocks/api";
import { visiteurConnecte } from "@/features/compte/session";

/**
 * Enveloppe des écrans visiteur.
 *
 * Le nombre de demandes en attente est calculé ici, une fois, et descendu à la
 * barre du bas : la pastille doit être juste sur tous les écrans, pas seulement
 * sur « Mes demandes ».
 *
 * Ce calcul ne doit jamais faire tomber la page. Une enveloppe s'applique à
 * **tous** les écrans visiteur : si le comptage échoue, c'est le catalogue, la
 * fiche, le formulaire et la confirmation qui disparaissent d'un coup — pour
 * une pastille. On préfère une pastille absente à un site absent.
 */
async function compterEnAttente(): Promise<number> {
  try {
    const visiteur = await visiteurConnecte();
    if (!visiteur) return 0;
    const demandes = await listerDemandes();
    return demandes.filter(attendUneAction).length;
  } catch (erreur) {
    if (
      typeof erreur === "object" &&
      erreur !== null &&
      "digest" in erreur &&
      (erreur as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw erreur;
    }
    // Journalisé côté serveur : une pastille muette ne doit pas masquer une
    // panne d'API à l'équipe.
    console.error("[layout visiteur] comptage des demandes indisponible", erreur);
    return 0;
  }
}

export default async function LayoutVisiteur({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  const enAttente = await compterEnAttente();

  return (
    <>
      {children}
      <PiedDePage langue={langue} />
      {/* Dégagement sous le pied de page : la barre du bas est fixe. */}
      <div aria-hidden="true" className="h-[calc(72px+env(safe-area-inset-bottom))] lg:hidden" />
      <BarreDuBas enAttente={enAttente} />
    </>
  );
}
