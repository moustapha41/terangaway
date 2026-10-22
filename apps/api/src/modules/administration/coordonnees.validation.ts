import { HttpStatus } from "@nestjs/common";
import type {
  CoordonneesLogement,
  CoordonneesVehicule,
  FamilleCoordonnees,
  SaisieCoordonneesAdmin,
} from "@teranga/contracts";

import { ErreurMetier } from "../../commun/erreurs";

/**
 * La validation des coordonnées, famille par famille.
 *
 * Fonction pure : elle se teste sans base. Ses erreurs nomment le champ en
 * cause, **jamais sa valeur** — une adresse ou un numéro ne doit pas finir
 * dans un message, et donc ni dans un journal, ni dans un écran d'erreur.
 */

/** Chiffres, espaces, `+`, points, tirets, parenthèses ; 6 à 30 caractères. */
const TELEPHONE = /^\+?[0-9][0-9 ().-]{5,29}$/;
/** Lettres, chiffres, espaces et tirets : la forme d'une plaque, sans plus. */
const IMMATRICULATION = /^[A-Za-z0-9][A-Za-z0-9 -]{1,19}$/;

interface RegleChamp {
  requis: boolean;
  max: number;
  forme?: RegExp;
}

const REGLES: Record<FamilleCoordonnees, Record<string, RegleChamp>> = {
  logement: {
    adresseExacte: { requis: true, max: 300 },
    telephone: { requis: true, max: 30, forme: TELEPHONE },
    consignesArrivee: { requis: false, max: 1000 },
  },
  vehicule: {
    immatriculation: { requis: true, max: 20, forme: IMMATRICULATION },
    telephoneChauffeur: { requis: true, max: 30, forme: TELEPHONE },
    lieuDeRendezVous: { requis: false, max: 300 },
  },
};

function invalide(champ: string, raison: string): ErreurMetier {
  return new ErreurMetier(
    "COORDONNEES_INVALIDES",
    `Champ « ${champ} » : ${raison}.`,
    HttpStatus.BAD_REQUEST,
  );
}

/**
 * Rend des coordonnées propres — espaces de bord retirés, champs facultatifs
 * vides omis — ou lève sur le premier champ fautif.
 *
 * Un champ de l'autre famille, ou inconnu, est refusé plutôt qu'ignoré : une
 * immatriculation envoyée pour un logement est une erreur de saisie, pas un
 * détail.
 */
export function validerCoordonnees(
  famille: FamilleCoordonnees,
  saisie: SaisieCoordonneesAdmin | Record<string, unknown>,
): CoordonneesLogement | CoordonneesVehicule {
  const regles = REGLES[famille];
  const propre: Record<string, string> = {};

  for (const [champ, valeur] of Object.entries(saisie ?? {})) {
    if (valeur === undefined) continue;
    if (!(champ in regles)) throw invalide(champ, `non attendu pour un ${famille}`);
    if (typeof valeur !== "string") throw invalide(champ, "doit être un texte");
  }

  for (const [champ, regle] of Object.entries(regles)) {
    const brute = (saisie as Record<string, unknown>)?.[champ];
    const valeur = typeof brute === "string" ? brute.trim() : "";
    if (!valeur) {
      if (regle.requis) throw invalide(champ, "obligatoire");
      continue;
    }
    if (valeur.length > regle.max) throw invalide(champ, `${regle.max} caractères au plus`);
    if (regle.forme && !regle.forme.test(valeur)) throw invalide(champ, "forme invalide");
    propre[champ] = valeur;
  }

  return propre as unknown as CoordonneesLogement | CoordonneesVehicule;
}
