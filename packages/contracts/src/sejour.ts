/**
 * Le séjour au-delà du logement : l'arrivée, le retour, ce qui se passe entre
 * les deux.
 *
 * Un visiteur qui réserve une maison n'a pas fini : il lui reste à y arriver,
 * à en repartir, et à vivre dix jours dans un pays qu'il ne connaît pas. Le
 * dossier de conception l'écrit dans sa cinquième règle — « le logement amène
 * au transport » — et c'est ce qu'une plateforme qui ne vend que des chambres
 * ne peut pas faire.
 *
 * Ce module ne décide que **où mène chaque accroche** : de quel lieu à quel
 * lieu, quel jour, pour combien de personnes. L'écran de confirmation, la
 * fiche du logement et l'e-mail partent tous des mêmes adresses ; trois copies
 * de cette règle auraient fini par diverger, et un visiteur arrivé par l'une
 * aurait trouvé un trajet différent de celui annoncé par l'autre.
 *
 * Les adresses sont **relatives** (`/transports/resultats?…`) : le site y
 * ajoute la langue, l'API y ajoute son domaine.
 */

/** Le lieu qui désigne l'aéroport dans le catalogue des véhicules. */
export const AEROPORT = "Aéroport AIBD";

/**
 * La valeur qu'un propriétaire met dans `quartier` quand il ne l'a pas dit.
 *
 * Elle ne désigne pas un lieu : l'écrire dans un trajet enverrait quelqu'un
 * de « Non précisé, Dakar » à l'aéroport.
 */
export const QUARTIER_INCONNU = "Non précisé";

export type SensTransfert = "arrivee" | "depart";

/**
 * L'heure proposée par défaut, faute de mieux.
 *
 * Personne ne connaît encore son heure de vol au moment de demander un
 * logement. Ce sont deux repères que le visiteur corrige à l'étape suivante,
 * pas des promesses : le matin, parce qu'un vol de retour part plus souvent
 * tôt que tard, et le milieu de matinée à l'arrivée.
 */
const HEURE_PAR_DEFAUT: Record<SensTransfert, string> = {
  arrivee: "10:00",
  depart: "08:00",
};

/**
 * Le lieu à nommer pour un logement : le quartier quand on le connaît, la
 * ville sinon.
 *
 * « Saly » n'est pas « Almadies, Dakar » : un chauffeur qui doit déposer
 * quelqu'un a besoin du plus fin des deux, mais jamais d'un quartier inventé.
 */
export function lieuDeSejour(logement: { quartier: string; ville: string }): string {
  const quartier = logement.quartier?.trim();
  if (!quartier || quartier === QUARTIER_INCONNU) return logement.ville;
  // « Saly, Saly » : le quartier qui répète la ville n'apprend rien.
  if (quartier.toLowerCase() === logement.ville.toLowerCase()) return logement.ville;
  return `${quartier}, ${logement.ville}`;
}

export interface EntreeTransfert {
  sens: SensTransfert;
  /** Le lieu du logement, tel que `lieuDeSejour` le nomme. */
  lieu: string;
  /** Premier jour du séjour, `AAAA-MM-JJ`. */
  debut: string;
  /** Dernier jour du séjour, `AAAA-MM-JJ`. */
  fin: string;
  personnes: number;
}

/**
 * L'adresse de la recherche de transfert, déjà remplie.
 *
 * À l'arrivée : de l'aéroport au logement, le premier jour. Au départ : du
 * logement à l'aéroport, le dernier. Le nombre de voyageurs suit — il
 * détermine la taille du véhicule, et le retaper serait la première raison
 * d'abandonner.
 */
export function lienTransfert({ sens, lieu, debut, fin, personnes }: EntreeTransfert): string {
  const jour = sens === "arrivee" ? debut : fin;
  // Pas de `URLSearchParams` : ce paquet ne dépend ni du DOM ni de Node, et il
  // doit le rester pour servir le site comme l'API.
  const params: Array<[string, string]> = [
    ["depart", sens === "arrivee" ? AEROPORT : lieu],
    ["arrivee", sens === "arrivee" ? lieu : AEROPORT],
    ["quand", `${jour}T${HEURE_PAR_DEFAUT[sens]}`],
    ["passagers", String(Math.max(1, Math.round(personnes)))],
  ];
  const requete = params.map(([cle, valeur]) => `${cle}=${encodeURIComponent(valeur)}`).join("&");
  return `/transports/resultats?${requete}`;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Une date `AAAA-MM-JJ` qui existe vraiment, ou `undefined`. */
export function jourValide(valeur: string | undefined): string | undefined {
  if (!valeur || !JOUR.test(valeur)) return undefined;
  const date = new Date(`${valeur}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== valeur
    ? undefined
    : valeur;
}
