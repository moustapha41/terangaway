import type { Logement } from "./types/logement";

/** Une semaine de séjour, telle que la plateforme la compte. */
export const NUITS_PAR_SEMAINE = 7;

/**
 * Un mois de séjour : trente nuits.
 *
 * Ni « du 1er au 1er », ni le nombre de jours du calendrier : un tarif mensuel
 * annoncé par un propriétaire ne varie pas de février à mars, et un séjour doit
 * coûter la même chose quelle que soit la date de départ.
 */
export const NUITS_PAR_MOIS = 30;

/**
 * Le prix d'une semaine : celui que le propriétaire annonce, ou sept nuitées.
 *
 * Plusieurs annonces portent un barème dégressif — une semaine y coûte moins
 * que sept fois la nuitée. Le prix affiché par la plateforme est celui de la
 * semaine (§C.4) : multiplier par sept dans le dos du propriétaire afficherait
 * un tarif qu'il n'a pas demandé.
 */
export function prixSemaine(
  logement: Pick<Logement, "prixParNuit" | "prixParSemaine">,
): number {
  return logement.prixParSemaine ?? logement.prixParNuit * NUITS_PAR_SEMAINE;
}

/** Ce qu'il faut savoir d'une annonce pour en chiffrer un séjour. */
type TarifsLogement = Pick<Logement, "prixParNuit" | "prixParSemaine" | "prixParMois">;

/**
 * Une ligne du prix d'un séjour : « 2 semaines × 650 000 F = 1 300 000 F ».
 *
 * `palier` dit à quel tarif la ligne est comptée, `quantite` combien de fois,
 * `tarif` le prix d'une unité **tel qu'il était à ce moment-là**. Une ligne se
 * suffit : la relire plus tard donne la même chose, sans rouvrir le catalogue.
 */
export interface LignePrix {
  palier: "mois" | "semaine" | "nuit";
  quantite: number;
  /** Le prix d'une unité du palier, en francs. */
  tarif: number;
  /** `quantite × tarif`. Écrit, et non recalculé à la lecture : il fait foi. */
  montant: number;
}

/**
 * Comment un séjour se chiffre, palier par palier.
 *
 * Trois paliers, du plus long au plus court, chacun au tarif **annoncé par le
 * propriétaire** quand il en a un :
 *   chaque mois entier de trente nuits, au tarif mensuel ;
 *   chaque semaine entière de ce qui reste, au tarif de la semaine ;
 *   les nuits qui restent, à la nuitée.
 *
 * Seuls les paliers utilisés figurent : un séjour de trois nuits n'a qu'une
 * ligne, « 3 nuits × 130 000 F ».
 *
 * Le tarif mensuel n'est jamais déduit d'un autre : une annonce qui n'en
 * annonce pas se compte en semaines, quelle que soit la durée. Inventer un
 * rabais que le propriétaire n'a pas consenti reviendrait à lui promettre un
 * prix à sa place.
 *
 * C'est de ces lignes que le total est fait — et non l'inverse. Le backoffice
 * affiche exactement celles que le visiteur a payées à l'écran : un détail
 * recalculé plus tard, d'après un catalogue qui aurait changé, ne tomberait plus
 * sur le total qu'on lui a annoncé.
 */
export function lignesSejour(logement: TarifsLogement, nuits: number): LignePrix[] {
  const mois = logement.prixParMois !== undefined ? Math.floor(nuits / NUITS_PAR_MOIS) : 0;
  const apresLesMois = nuits - mois * NUITS_PAR_MOIS;
  const semaines = Math.floor(apresLesMois / NUITS_PAR_SEMAINE);
  const reste = apresLesMois % NUITS_PAR_SEMAINE;

  const lignes: LignePrix[] = [];
  const ajouter = (palier: LignePrix["palier"], quantite: number, tarif: number) => {
    if (quantite > 0) lignes.push({ palier, quantite, tarif, montant: quantite * tarif });
  };

  ajouter("mois", mois, logement.prixParMois ?? 0);
  ajouter("semaine", semaines, prixSemaine(logement));
  ajouter("nuit", reste, logement.prixParNuit);
  return lignes;
}

/**
 * L'hébergement d'un séjour, hors frais fixes : la somme de ses lignes.
 *
 * Pour une annonce sans tarif mensuel ni hebdomadaire, la règle se réduit
 * exactement à l'ancienne — nuitée multipliée par le nombre de nuits.
 *
 * Cette fonction vit dans les contrats parce que le site et l'API doivent
 * compter pareil : un total annoncé sur une fiche et un total enregistré en
 * base qui divergeraient de quelques dizaines de milliers de francs, c'est un
 * litige avec le visiteur, pas un écart d'affichage.
 */
export function sousTotalSejour(logement: TarifsLogement, nuits: number): number {
  return lignesSejour(logement, nuits).reduce((somme, ligne) => somme + ligne.montant, 0);
}

/** Le total d'un séjour : l'hébergement et les frais annoncés avec lui. */
export function totalSejour(
  logement: TarifsLogement,
  nuits: number,
  fraisFixes: readonly { montant: number }[] = [],
): number {
  return sousTotalSejour(logement, nuits) + fraisFixes.reduce((s, f) => s + f.montant, 0);
}
