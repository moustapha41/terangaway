import type {
  CoordonneesAdmin,
  FamilleCoordonnees,
  SaisieCoordonneesAdmin,
  TraceCoordonnees,
} from "@teranga/contracts";

/**
 * Ce que l'écran des coordonnées décide, sans React : testable seul.
 *
 * L'API reste juge de tout — statut, quatre yeux, validation. Ces fonctions ne
 * font que choisir quoi montrer et quel texte poser sur un refus.
 */

export type CleChampCoordonnees = keyof SaisieCoordonneesAdmin;

export interface ChampCoordonnees {
  cle: CleChampCoordonnees;
  requis: boolean;
  multiligne?: boolean;
  type?: "tel";
}

/** Les champs de chaque famille — les mêmes que ceux que l'API exige. */
export const CHAMPS_COORDONNEES: Record<FamilleCoordonnees, readonly ChampCoordonnees[]> = {
  logement: [
    { cle: "adresseExacte", requis: true },
    { cle: "telephone", requis: true, type: "tel" },
    { cle: "consignesArrivee", requis: false, multiligne: true },
  ],
  vehicule: [
    { cle: "immatriculation", requis: true },
    { cle: "telephoneChauffeur", requis: true, type: "tel" },
    { cle: "lieuDeRendezVous", requis: false },
  ],
};

/** Le formulaire pré-rempli avec ce qui est enregistré, champ par champ. */
export function saisieInitiale(vue: CoordonneesAdmin): Record<CleChampCoordonnees, string> {
  const valeurs: Record<string, string> = {};
  if (!vue.famille) return valeurs as Record<CleChampCoordonnees, string>;
  const enregistrees = (vue.coordonnees ?? {}) as Record<string, unknown>;
  for (const champ of CHAMPS_COORDONNEES[vue.famille]) {
    const valeur = enregistrees[champ.cle];
    valeurs[champ.cle] = typeof valeur === "string" ? valeur : "";
  }
  return valeurs as Record<CleChampCoordonnees, string>;
}

/** Ce qui part à l'API : les seuls champs de la famille, les vides omis. */
export function saisieAEnvoyer(
  famille: FamilleCoordonnees,
  valeurs: Partial<Record<CleChampCoordonnees, string>>,
): SaisieCoordonneesAdmin {
  const saisie: SaisieCoordonneesAdmin = {};
  for (const champ of CHAMPS_COORDONNEES[famille]) {
    const valeur = valeurs[champ.cle]?.trim();
    if (valeur) saisie[champ.cle] = valeur;
  }
  return saisie;
}

/**
 * Le visiteur les voit-il ? Seulement vérifiées — preuve en base — et à
 * « confirmee » ou « terminee ». C'est la règle de l'API, répétée ici pour le
 * dire à l'équipe, pas pour l'appliquer.
 */
export function visiblesParLeVisiteur(vue: CoordonneesAdmin): boolean {
  return vue.etat === "verifiees" && (vue.statut === "confirmee" || vue.statut === "terminee");
}

/** Un nom à montrer pour une personne de l'équipe : nom, sinon adresse, sinon identifiant. */
export function nomActeur(trace: TraceCoordonnees): string {
  return trace.par.nom?.trim() || trace.par.email?.trim() || trace.par.id;
}

/**
 * La clé de texte d'un refus de l'API, ou `null` quand le message serveur est
 * le bon texte — une validation, qui nomme le champ fautif sans sa valeur.
 */
export function cleErreurCoordonnees(code: string): string | null {
  switch (code) {
    case "COORDONNEES_INVALIDES":
      return null;
    case "COORDONNEES_QUATRE_YEUX":
      return "admin.coordonnees.erreurQuatreYeux";
    case "COORDONNEES_CONFLIT":
      return "admin.coordonnees.erreurConflit";
    case "COORDONNEES_STATUT_NON_ELIGIBLE":
      return "admin.coordonnees.erreurStatut";
    case "COORDONNEES_DEJA_VERIFIEES":
      return "admin.coordonnees.erreurDejaVerifiees";
    case "COORDONNEES_ABSENTES":
    case "COORDONNEES_A_RESAISIR":
    case "COORDONNEES_SAISIE_NON_TRACEE":
      return "admin.coordonnees.erreurARessaisir";
    case "COORDONNEES_GENRE_NON_PRIS_EN_CHARGE":
      return "admin.coordonnees.nonPrevues";
    case "COORDONNEES_MIGRATION_EN_ATTENTE":
      return "admin.coordonnees.erreurMigration";
    case "NON_AUTHENTIFIE":
    case "ACCES_INTERDIT":
      return "admin.coordonnees.erreurSession";
    case "INJOIGNABLE":
      return "admin.coordonnees.erreurServeur";
    default:
      return "admin.coordonnees.erreurServeur";
  }
}
