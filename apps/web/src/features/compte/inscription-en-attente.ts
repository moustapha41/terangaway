import { cookies } from "next/headers";

/**
 * L'inscription en cours, le temps d'aller lire son e-mail.
 *
 * Entre `/inscription` et `/inscription/verification`, il faut se souvenir de
 * l'adresse à vérifier et de la destination où revenir. Trois façons de le
 * faire, et une seule tenable :
 *
 *   · un paramètre d'URL `?email=…` : l'adresse part dans l'historique du
 *     navigateur, dans l'en-tête `Referer` vers les ressources externes, et
 *     dans les journaux d'accès du serveur. Pour une adresse e-mail, non ;
 *   · l'état React : perdu au rechargement, et la page de vérification doit
 *     pouvoir s'ouvrir directement depuis un onglet rouvert ;
 *   · un cookie `httpOnly` de courte durée : invisible au JavaScript de la
 *     page, absent des URL, et il disparaît tout seul.
 *
 * C'est la troisième. Ce cookie **n'authentifie rien** : il ne dit que « une
 * inscription a été ouverte pour cette adresse ». Le droit d'entrer vient du
 * code reçu par e-mail, vérifié par l'API.
 */
export const COOKIE_INSCRIPTION = "teranga_inscription";

/**
 * Vingt minutes : le code vaut dix minutes, et il faut de la marge pour en
 * demander un second sans recommencer toute l'inscription.
 */
export const DUREE_INSCRIPTION_SECONDES = 20 * 60;

export interface InscriptionEnAttente {
  email: string;
  /** La destination demandée avant l'inscription, à retrouver après vérification. */
  suite?: string;
}

/**
 * Encodage en base64url.
 *
 * Pas du chiffrement, et ce n'est pas le but : le cookie est `httpOnly`, donc
 * la page n'y accède pas, et son contenu ne vaut rien sans le code. L'encodage
 * sert seulement à faire tenir une adresse e-mail et un chemin dans une valeur
 * de cookie sans se battre avec les caractères interdits.
 */
function encoder(valeur: InscriptionEnAttente): string {
  return Buffer.from(JSON.stringify(valeur), "utf-8").toString("base64url");
}

function decoder(brut: string): InscriptionEnAttente | null {
  try {
    const objet = JSON.parse(Buffer.from(brut, "base64url").toString("utf-8")) as unknown;
    if (!objet || typeof objet !== "object") return null;

    const { email, suite } = objet as Record<string, unknown>;
    // Une adresse est le minimum : sans elle, le cookie ne sert à rien.
    if (typeof email !== "string" || !email.includes("@")) return null;

    return {
      email,
      suite: typeof suite === "string" ? suite : undefined,
    };
  } catch {
    // Cookie tronqué, réécrit à la main ou laissé par une version antérieure :
    // on l'ignore, et la personne reprend l'inscription.
    return null;
  }
}

export async function poserInscriptionEnAttente(valeur: InscriptionEnAttente): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_INSCRIPTION, encoder(valeur), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_INSCRIPTION_SECONDES,
  });
}

export async function lireInscriptionEnAttente(): Promise<InscriptionEnAttente | null> {
  const jar = await cookies();
  const brut = jar.get(COOKIE_INSCRIPTION)?.value;
  return brut ? decoder(brut) : null;
}

export async function effacerInscriptionEnAttente(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_INSCRIPTION);
}

/**
 * Masque une adresse pour l'afficher.
 *
 * La page de vérification doit confirmer **où** le code est parti, sans étaler
 * l'adresse complète sur un écran qu'on consulte parfois en public. On garde
 * de quoi reconnaître la sienne et constater une faute de frappe :
 * `rokhaya.seck@exemple.sn` devient `ro•••••••••k@exemple.sn`.
 */
export function masquerEmail(email: string): string {
  const [local, domaine] = email.split("@");
  if (!domaine) return email;
  if (local.length <= 2) return `${local}@${domaine}`;

  const debut = local.slice(0, 2);
  const fin = local.slice(-1);
  return `${debut}${"•".repeat(Math.max(1, local.length - 3))}${fin}@${domaine}`;
}
