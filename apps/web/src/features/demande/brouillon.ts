import { cookies } from "next/headers";

/**
 * La demande en cours de saisie, mise de côté le temps de créer un compte.
 *
 * Le tunnel de réservation gardait tout dans l'état du composant : c'était
 * suffisant tant que la vérification se faisait en feuille basse, sans quitter
 * la page. Dès qu'on passe par `/inscription`, puis par la boîte e-mail, puis
 * par `/inscription/verification`, la page est démontée et la saisie perdue —
 * le visiteur revient devant un formulaire vide après avoir choisi ses dates,
 * son nombre de voyageurs et écrit son message.
 *
 * D'où ce brouillon. Même choix que pour l'inscription en attente : un cookie
 * `httpOnly` et de courte durée, plutôt que l'URL — un message libre et un
 * numéro de téléphone n'ont rien à faire dans un historique de navigation.
 *
 * Il **n'autorise rien**. Il ne porte que de la saisie, et la demande n'est
 * envoyée qu'avec une session vérifiée. Les valeurs qui en sortent sont
 * traitées comme n'importe quelle saisie : revalidées par la Server Action,
 * puis par l'API.
 */
export const COOKIE_BROUILLON = "teranga_brouillon_demande";

/** Trente minutes : le temps de créer un compte et de relever son courrier. */
export const DUREE_BROUILLON_SECONDES = 30 * 60;

export interface BrouillonLogement {
  genre: "logement";
  logementId: string;
  debut: string;
  fin: string;
  personnes: number;
  nom?: string;
  email?: string;
  telephone?: string;
  message?: string;
}

export interface BrouillonTransport {
  genre: "vehicule";
  vehiculeId: string;
  prestation: "trajet" | "journee" | "taxi";
  depart: string;
  arrivee?: string;
  quand: string;
  passagers: number;
  bagages?: number;
  vol?: string;
  nom?: string;
  email?: string;
  telephone?: string;
  message?: string;
}

export type BrouillonDemande = BrouillonLogement | BrouillonTransport;

/** Bornes de sûreté : un cookie ne doit pas pouvoir enfler indéfiniment. */
const LONGUEUR_MAXIMALE_TEXTE = 2000;
const LONGUEUR_MAXIMALE_COURTE = 200;

const texte = (valeur: unknown, maximum = LONGUEUR_MAXIMALE_COURTE): string | undefined => {
  if (typeof valeur !== "string") return undefined;
  const propre = valeur.trim();
  return propre.length > 0 ? propre.slice(0, maximum) : undefined;
};

const entier = (valeur: unknown, defaut: number): number => {
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return defaut;
  return Math.min(50, Math.max(0, Math.round(nombre)));
};

/**
 * Relit un brouillon en le normalisant champ par champ.
 *
 * Le cookie est `httpOnly`, mais il a pu être écrit par une version antérieure,
 * tronqué, ou forgé par quelqu'un qui contrôle son propre navigateur. On ne
 * fait donc pas confiance à sa forme : chaque champ est retypé et borné, et le
 * tout est rejeté si le genre n'est pas reconnu.
 */
function decoder(brut: string): BrouillonDemande | null {
  try {
    const objet = JSON.parse(Buffer.from(brut, "base64url").toString("utf-8")) as unknown;
    if (!objet || typeof objet !== "object") return null;
    const source = objet as Record<string, unknown>;

    const commun = {
      nom: texte(source.nom),
      email: texte(source.email),
      telephone: texte(source.telephone),
      message: texte(source.message, LONGUEUR_MAXIMALE_TEXTE),
    };

    if (source.genre === "logement") {
      const logementId = texte(source.logementId);
      const debut = texte(source.debut);
      const fin = texte(source.fin);
      if (!logementId || !debut || !fin) return null;
      return {
        genre: "logement",
        logementId,
        debut,
        fin,
        personnes: entier(source.personnes, 2),
        ...commun,
      };
    }

    if (source.genre === "vehicule") {
      const vehiculeId = texte(source.vehiculeId);
      const depart = texte(source.depart);
      const quand = texte(source.quand);
      const prestation = source.prestation;
      if (!vehiculeId || !depart || !quand) return null;
      if (prestation !== "trajet" && prestation !== "journee" && prestation !== "taxi") return null;
      return {
        genre: "vehicule",
        vehiculeId,
        prestation,
        depart,
        arrivee: texte(source.arrivee),
        quand,
        passagers: entier(source.passagers, 2),
        bagages: entier(source.bagages, 0),
        vol: texte(source.vol),
        ...commun,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function poserBrouillon(brouillon: BrouillonDemande): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_BROUILLON, Buffer.from(JSON.stringify(brouillon), "utf-8").toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_BROUILLON_SECONDES,
  });
}

export async function lireBrouillon(): Promise<BrouillonDemande | null> {
  const jar = await cookies();
  const brut = jar.get(COOKIE_BROUILLON)?.value;
  return brut ? decoder(brut) : null;
}

/**
 * Le brouillon d'un logement donné, ou `null`.
 *
 * Le filtre sur l'identifiant compte : revenir sur une *autre* fiche ne doit
 * pas préremplir le formulaire avec les dates d'une réservation abandonnée
 * ailleurs.
 */
export async function lireBrouillonLogement(logementId: string): Promise<BrouillonLogement | null> {
  const brouillon = await lireBrouillon();
  if (!brouillon || brouillon.genre !== "logement") return null;
  return brouillon.logementId === logementId ? brouillon : null;
}

export async function lireBrouillonTransport(
  vehiculeId: string,
): Promise<BrouillonTransport | null> {
  const brouillon = await lireBrouillon();
  if (!brouillon || brouillon.genre !== "vehicule") return null;
  return brouillon.vehiculeId === vehiculeId ? brouillon : null;
}

export async function effacerBrouillon(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_BROUILLON);
}
