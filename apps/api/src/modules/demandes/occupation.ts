import { HttpStatus } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { ErreurMetier } from "../../commun/erreurs";

/**
 * Une offre ne se confirme qu'une fois sur des dates qui se recouvrent.
 *
 * Tout vient des colonnes que chaque demande porte déjà — `offreId`, `genre`,
 * `dateDebut`, `dateFin`, `statut` — : ni calendrier ni table de plus. Les règles :
 *
 *   `logement`  intervalle semi-ouvert [arrivée, départ) : deux séjours qui se
 *               touchent (le départ de l'un est l'arrivée de l'autre) cohabitent.
 *               Une demande dont le départ n'est pas après l'arrivée compte une nuit,
 *               comme son prix (`nuits = max(1, …)`).
 *   `location`  un véhicule, une réservation par jour calendaire. Un seul instant est
 *               stocké (`quand`), pas de durée : c'est donc le jour qui fait foi.
 *
 * Taxis, trajets et services ne sont pas concernés : ils n'occupent pas une offre
 * sur une période, et leurs règles ne changent pas.
 *
 * Seules les demandes `confirmee` occupent une offre. Une demande acceptée ne la
 * retient pas (LOG-24 n'est pas implémenté), refusée, expirée ou annulée non plus.
 */

export const GENRES_A_GARDE = ["logement", "location"] as const;
export type GenreAGarde = (typeof GENRES_A_GARDE)[number];

export function genreAGarde(genre: string): genre is GenreAGarde {
  return (GENRES_A_GARDE as readonly string[]).includes(genre);
}

/** Ce qui définit l'occupation d'une demande. */
export interface PlageDemande {
  genre: string;
  dateDebut: string | null;
  dateFin: string | null;
}

const JOUR = /^\d{4}-\d{2}-\d{2}/;

/** La partie « jour » d'une date ISO, ou `undefined` si elle n'est pas lisible. */
export function jourDe(date: string | null | undefined): string | undefined {
  if (!date || !JOUR.test(date)) return undefined;
  const jour = date.slice(0, 10);
  // Une date impossible (31 février) ne se compare pas : `Date` la reporterait au mois suivant.
  const lue = new Date(`${jour}T00:00:00Z`);
  return Number.isNaN(lue.getTime()) || lue.toISOString().slice(0, 10) !== jour ? undefined : jour;
}

function lendemain(jour: string): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Le jour de départ effectif : au moins une nuit après l'arrivée. */
export function departEffectif(debut: string, fin: string | undefined): string {
  return fin !== undefined && fin > debut ? fin : lendemain(debut);
}

/**
 * Deux plages occupent-elles la même offre en même temps ?
 *
 * Fonction pure, sans base : les cas limites se testent ici. Une date illisible rend
 * la comparaison impossible — alors elle ne conclut pas à un conflit, car on ne
 * refuse pas une confirmation sur une donnée qu'on ne sait pas lire.
 */
export function plagesSeChevauchent(genre: GenreAGarde, a: PlageDemande, b: PlageDemande): boolean {
  const debutA = jourDe(a.dateDebut);
  const debutB = jourDe(b.dateDebut);
  if (debutA === undefined || debutB === undefined) return false;

  if (genre === "location") return debutA === debutB;

  const finA = departEffectif(debutA, jourDe(a.dateFin));
  const finB = departEffectif(debutB, jourDe(b.dateFin));
  return debutA < finB && debutB < finA;
}

/** Le refus rendu au visiteur. Il ne nomme jamais l'autre réservation ni son titulaire. */
export function offreDejaConfirmee(): ErreurMetier {
  return new ErreurMetier(
    "OFFRE_DEJA_CONFIRMEE",
    "Cette offre est déjà confirmée pour des dates qui recouvrent les vôtres : " +
      "votre demande ne peut pas être confirmée.",
    HttpStatus.CONFLICT,
  );
}

type Client = Prisma.TransactionClient;

/** La demande dont on cherche l'occupation. */
export interface DemandeOccupante extends PlageDemande {
  id: string;
  offreId: string | null;
}

/**
 * Prend le verrou de l'offre, jusqu'à la fin de la transaction.
 *
 * Deux confirmations de la même offre s'ordonnent ; deux offres différentes ne
 * s'attendent pas (la clé est l'offre). Verrou consultatif, donc sans ligne à
 * verrouiller : il couvre aussi une offre sans aucune demande confirmée, là où un
 * `FOR UPDATE` n'aurait rien à saisir. Deux entiers : une collision de hachage ne
 * ferait que sérialiser deux offres, jamais en confondre deux.
 */
export async function verrouillerOffre(tx: Client, offreId: string): Promise<void> {
  // `$executeRaw` et non `$queryRaw` : la fonction rend une colonne `void`, que Prisma
  // ne sait pas lire. Le verrou est pris ; il n'y a rien à récupérer.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('teranga:offre'), hashtext(${offreId}))`;
}

/**
 * Une **autre** demande confirmée occupe-t-elle déjà cette offre sur ces dates ?
 *
 * La demande elle-même est exclue (`id <>`). Le filtre SQL ne fait que réduire les
 * candidats — il est volontairement large : la décision revient à
 * `plagesSeChevauchent`, qui se teste sans base.
 */
export async function autreDemandeConfirmeeEnConflit(client: Client, demande: DemandeOccupante): Promise<boolean> {
  if (!demande.offreId || !genreAGarde(demande.genre)) return false;
  const debut = jourDe(demande.dateDebut);
  if (debut === undefined) return false;

  const candidates =
    demande.genre === "location"
      ? await client.$queryRaw<PlageDemande[]>`
          SELECT "genre"::text AS genre, "dateDebut", "dateFin"
          FROM "demands"
          WHERE "offreId" = ${demande.offreId}
            AND "genre" = 'location'::"GenreOffreDb"
            AND "statut" = 'confirmee'::"StatutDemandeDb"
            AND "id" <> ${demande.id}
            AND substr("dateDebut", 1, 10) = ${debut}`
      : await client.$queryRaw<PlageDemande[]>`
          SELECT "genre"::text AS genre, "dateDebut", "dateFin"
          FROM "demands"
          WHERE "offreId" = ${demande.offreId}
            AND "genre" = 'logement'::"GenreOffreDb"
            AND "statut" = 'confirmee'::"StatutDemandeDb"
            AND "id" <> ${demande.id}
            AND substr("dateDebut", 1, 10) <= ${departEffectif(debut, jourDe(demande.dateFin))}
            AND GREATEST(substr("dateFin", 1, 10), substr("dateDebut", 1, 10)) >= ${debut}`;

  return candidates.some((autre) => plagesSeChevauchent(demande.genre as GenreAGarde, demande, autre));
}
