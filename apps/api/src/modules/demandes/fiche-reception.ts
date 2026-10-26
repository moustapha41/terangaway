import {
  dureeDeNuits,
  lieuDeSejour,
  type CleDuree,
  type Demande,
  type LignePrix,
  type PrixSejour,
} from "@teranga/contracts";

/**
 * Ce que l'équipe doit lire à la réception d'une demande.
 *
 * L'alerte disait « Type : logement » et « Séjour : 1 nov. → 8 nov. » : ni la
 * durée, ni le détail du prix, ni le quartier. Pour un transport, elle ne disait
 * ni le trajet, ni l'heure de prise en charge, ni le vol, ni les bagages — il
 * fallait ouvrir le backoffice pour savoir où aller chercher quelqu'un.
 *
 * Ce module compose ces lignes, genre par genre. Il est pur : il reçoit ce que
 * l'on sait au moment de la création et rend des paires « libellé : valeur », que
 * l'e-mail affiche telles quelles. Il ne lit ni la base ni le catalogue.
 */

export type LigneFiche = [libelle: string, valeur: string];

/** Le total en francs, monnaie du paiement : c'est celle que l'équipe manie. */
export function formaterFrancs(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant).replace(/[  ]/g, " ")} FCFA`;
}

/* ─────────────────────────────── La durée ─────────────────────────────── */

const LIBELLE_DUREE: Record<CleDuree, string> = {
  troisJours: "3 jours",
  uneSemaine: "1 semaine",
  deuxSemaines: "2 semaines",
  troisSemaines: "3 semaines",
  unMois: "1 mois",
};

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * « 7 nuits · 1 semaine », ou « 5 nuits · dates choisies à la main ».
 *
 * Le visiteur choisit une durée dans le formulaire, mais l'API n'en garde que les
 * dates : elle se relit d'après les nuits. Cinq nuits ne sont aucune des cinq
 * durées proposées — l'équipe doit savoir qu'elles ont été choisies sur le
 * calendrier, pas arrondies à la plus proche.
 */
export function dureeLisible(nuits: number): string {
  const cle = dureeDeNuits(nuits);
  return `${pluriel(nuits, "nuit", "nuits")} · ${cle ? LIBELLE_DUREE[cle] : "dates choisies à la main"}`;
}

/* ─────────────────────────────── Les dates ─────────────────────────────── */

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * « 1 novembre 2026 » à partir d'un `AAAA-MM-JJ` — sans passer par `Date`.
 *
 * Une date sans heure ne doit pas glisser d'un jour selon le fuseau de la
 * machine qui l'écrit : le jour d'arrivée est celui que le visiteur a choisi.
 */
export function jourLisible(iso: string | undefined): string | undefined {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const mois = MOIS[Number(m[2]) - 1];
  return mois ? `${Number(m[3])} ${mois} ${m[1]}` : undefined;
}

/**
 * « 2 novembre 2026 à 10:00 » à partir de `2026-11-02T10:00`.
 *
 * L'heure est lue **telle qu'elle a été saisie**, sans conversion : c'est l'heure
 * de Dakar que le visiteur a donnée, et la convertir la ferait bouger d'une
 * machine à l'autre — la prise en charge, elle, n'a qu'une heure.
 */
export function momentLisible(iso: string | undefined): string | undefined {
  const jour = jourLisible(iso);
  if (!jour) return undefined;
  const heure = iso?.match(/T(\d{2}):(\d{2})/);
  return heure ? `${jour} à ${heure[1]}:${heure[2]}` : jour;
}

/* ───────────────────────────── Le prix, en lignes ───────────────────────────── */

const PALIER: Record<LignePrix["palier"], [string, string]> = {
  mois: ["mois", "mois"],
  semaine: ["semaine", "semaines"],
  nuit: ["nuit", "nuits"],
};

/**
 * Le prix d'un séjour, ligne par ligne : « 2 semaines × 650 000 FCFA ».
 *
 * Les lignes viennent de la demande : elles ont été **figées avec le total**, et
 * sont relues telles quelles. Une demande antérieure à leur enregistrement n'en a
 * pas : on le dit — recalculer d'après le catalogue d'aujourd'hui afficherait
 * peut-être un détail qui ne tombe plus sur le total annoncé.
 */
export function lignesDePrix(prix: PrixSejour): LigneFiche[] {
  const lignes: LigneFiche[] = [];

  if (prix.lignes && prix.lignes.length > 0) {
    for (const ligne of prix.lignes) {
      const [un, plusieurs] = PALIER[ligne.palier];
      lignes.push([
        pluriel(ligne.quantite, un, plusieurs),
        `${formaterFrancs(ligne.tarif)} × ${ligne.quantite} = ${formaterFrancs(ligne.montant)}`,
      ]);
    }
  } else if (prix.nuits > 0) {
    lignes.push(["Hébergement", `${pluriel(prix.nuits, "nuit", "nuits")} — détail du tarif non conservé`]);
  }

  for (const frais of prix.fraisFixes) {
    lignes.push([frais.libelle, formaterFrancs(frais.montant)]);
  }
  return lignes;
}

/* ───────────────────────────── Un logement ───────────────────────────── */

/**
 * Ce qu'il faut savoir d'une demande de logement : où, combien de temps, combien
 * de personnes sur combien de places, et comment le prix est fait.
 *
 * `logement` est facultatif : si le catalogue n'a pas répondu, les lignes qui en
 * dépendent disparaissent plutôt que d'être inventées.
 */
export function lignesLogement(
  demande: Demande,
  logement?: { quartier: string; ville: string; capacite: number },
): LigneFiche[] {
  const lignes: LigneFiche[] = [];

  if (logement) lignes.push(["Lieu", lieuDeSejour(logement)]);

  const arrivee = jourLisible(demande.dates.debut);
  const depart = jourLisible(demande.dates.fin);
  if (arrivee) lignes.push(["Arrivée", arrivee]);
  if (depart) lignes.push(["Départ", depart]);
  // Le prix d'un logement porte ses nuits ; sans elles, la durée se tire des dates.
  const prix = "nuits" in demande.prix ? demande.prix : undefined;
  if (prix) lignes.push(["Durée", dureeLisible(prix.nuits)]);

  lignes.push([
    "Voyageurs",
    logement ? `${demande.personnes} sur ${logement.capacite} places` : String(demande.personnes),
  ]);

  if (demande.heureArrivee) lignes.push(["Heure d'arrivée prévue", demande.heureArrivee]);

  if (prix) lignes.push(...lignesDePrix(prix));
  return lignes;
}

/* ───────────────────────────── Un transport ───────────────────────────── */

export const PRESTATION_LISIBLE = {
  trajet: "Trajet avec chauffeur",
  journee: "Location avec chauffeur, à la journée",
  taxi: "Taxi",
} as const;

export interface DonneesTransport {
  prestation: keyof typeof PRESTATION_LISIBLE;
  depart: string;
  arrivee?: string;
  quand: string;
  passagers: number;
  bagages: number;
  vol?: string;
}

/**
 * Un transport : le trajet, **l'heure de prise en charge**, les bagages, le vol.
 *
 * C'est ce qu'un chauffeur doit savoir avant toute autre chose, et c'est ce que
 * l'alerte ne disait pas : elle donnait le jour d'un séjour qui n'en est pas un.
 */
export function lignesTransport(d: DonneesTransport): LigneFiche[] {
  const lignes: LigneFiche[] = [["Prestation", PRESTATION_LISIBLE[d.prestation]]];

  lignes.push(["Trajet", d.arrivee ? `${d.depart} → ${d.arrivee}` : d.depart]);

  const moment = momentLisible(d.quand);
  if (moment) lignes.push(["Prise en charge", moment]);

  lignes.push(["Passagers", String(d.passagers)]);
  lignes.push(["Bagages", String(d.bagages)]);
  if (d.vol) lignes.push(["Numéro de vol", d.vol]);
  return lignes;
}

/* ───────────────────────────── Un service ───────────────────────────── */

const CHAMP_SERVICE: Record<string, string> = {
  date: "Date",
  personnes: "Personnes",
  besoin: "Besoin",
  langue: "Langue",
  theme: "Thème",
  duree: "Durée",
  moment: "Moment",
  cuisine: "Cuisine",
  quartier: "Quartier",
  lignes: "Nombre de lignes",
  formule: "Formule",
  donnees: "Données",
  livraison: "Livraison",
};

/** « accueil-aeroport » → « accueil aeroport » : lisible sans prétendre traduire. */
const adoucir = (valeur: string) => valeur.replace(/[-_]/g, " ");

/** Ce que le visiteur a décrit pour un service à la demande, champ par champ. */
export function lignesService(details: Record<string, string>): LigneFiche[] {
  return Object.entries(details)
    .filter(([, valeur]) => valeur.trim().length > 0)
    .map(([cle, valeur]): LigneFiche => [CHAMP_SERVICE[cle] ?? adoucir(cle), adoucir(valeur)]);
}
