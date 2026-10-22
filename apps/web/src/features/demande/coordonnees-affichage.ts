import type { CoordonneesLogement, CoordonneesVehicule, Demande } from "@teranga/contracts";

/**
 * Ce que l'écran d'une demande doit montrer à la place des coordonnées.
 *
 * L'API ne rend les coordonnées qu'aux statuts « confirmee » et « terminee »,
 * et seulement quand l'équipe les a saisies. Une demande confirmée peut donc
 * n'en avoir aucune : lui afficher « elles apparaissent après votre
 * confirmation » serait faux — elle est confirmée. Et une demande morte n'en
 * aura jamais : ne rien promettre.
 *
 * Les coordonnées d'un véhicule n'ont pas la forme de celles d'un logement :
 * on les distingue par leurs champs, jamais par un transtypage, qui faisait
 * lire `telephone` sur un objet qui n'a que `telephoneChauffeur`.
 */
export type VueCoordonnees =
  | {
      type: "logement";
      adresse: string;
      telephone: string;
      lienTelephone: string;
      consignes?: string;
    }
  | {
      type: "vehicule";
      immatriculation: string;
      telephone: string;
      lienTelephone: string;
      lieuDeRendezVous?: string;
    }
  /** Confirmée, sans coordonnées encore : l'équipe les transmet. */
  | { type: "en_preparation" }
  /** Pas encore confirmée : elles viendront après la confirmation. */
  | { type: "apres_confirmation" }
  /** Annulée, expirée, refusée : rien à montrer, rien à promettre. */
  | { type: "aucune" };

const STATUTS_REVELES = ["confirmee", "terminee"];
const STATUTS_EN_COURS = ["envoyee", "acceptee"];

function estCoordonneesVehicule(valeur: unknown): valeur is CoordonneesVehicule {
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    typeof (valeur as CoordonneesVehicule).immatriculation === "string" &&
    typeof (valeur as CoordonneesVehicule).telephoneChauffeur === "string"
  );
}

function estCoordonneesLogement(valeur: unknown): valeur is CoordonneesLogement {
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    typeof (valeur as CoordonneesLogement).adresseExacte === "string" &&
    typeof (valeur as CoordonneesLogement).telephone === "string"
  );
}

/** « tel:+221… » sans espaces : un lien qu'un téléphone sait composer. */
export function lienTelephone(numero: string): string {
  return `tel:${numero.replace(/\s/g, "")}`;
}

export function vueCoordonnees(demande: Pick<Demande, "statut" | "coordonnees">): VueCoordonnees {
  if (STATUTS_REVELES.includes(demande.statut)) {
    const coordonnees = demande.coordonnees;
    if (estCoordonneesVehicule(coordonnees)) {
      return {
        type: "vehicule",
        immatriculation: coordonnees.immatriculation,
        telephone: coordonnees.telephoneChauffeur,
        lienTelephone: lienTelephone(coordonnees.telephoneChauffeur),
        lieuDeRendezVous: coordonnees.lieuDeRendezVous,
      };
    }
    if (estCoordonneesLogement(coordonnees)) {
      return {
        type: "logement",
        adresse: coordonnees.adresseExacte,
        telephone: coordonnees.telephone,
        lienTelephone: lienTelephone(coordonnees.telephone),
        consignes: coordonnees.consignesArrivee,
      };
    }
    // Absentes, ou d'une forme qu'on ne sait pas lire : on n'affiche rien de
    // partiel, on dit qu'elles arrivent.
    return { type: "en_preparation" };
  }
  if (STATUTS_EN_COURS.includes(demande.statut)) return { type: "apres_confirmation" };
  return { type: "aucune" };
}
