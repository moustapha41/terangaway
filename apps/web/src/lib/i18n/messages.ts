import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { Langue } from "./langues";
import { creerTraducteur, type Catalogue, type Traducteur } from "./traducteur";

/**
 * Les trois catalogues, côté serveur uniquement.
 *
 * Aucun composant client ne doit importer ce fichier : il embarquerait les trois
 * langues. Les composants client reçoivent le catalogue actif par le contexte.
 */
const CATALOGUES: Record<Langue, Catalogue> = { fr, en, es };

/** Le français est la langue de référence : c'est elle qui définit les clés. */
export type Messages = typeof fr;

export function catalogue(langue: Langue): Catalogue {
  return CATALOGUES[langue];
}

/** Traduire depuis un composant serveur. */
export function traducteurPour(langue: Langue): Traducteur {
  return creerTraducteur(CATALOGUES[langue], langue);
}
