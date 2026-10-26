import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { config } from "../../config/configuration";

const SEL_PAR_DEFAUT = process.env.OTP_SECRET ?? "teranga-securite-sel-2026";

/**
 * Calcule une empreinte HMAC-SHA-256 avec clé secrète serveur dédiée.
 * Protège formellement les secrets à faible entropie (codes OTP à 6 chiffres = 1M de possibilités)
 * contre toute recherche exhaustive hors-ligne en cas de fuite de la base de données.
 */
export function hacherOtp(code: string, secret = config.otpSecret): string {
  return createHmac("sha256", secret)
    .update(code)
    .digest("hex");
}

function verifierHmacUnitaire(code: string, hashAttendu: string, secret: string): boolean {
  const hashCalculeHmac = hacherOtp(code, secret);
  const bufferA = Buffer.from(hashCalculeHmac, "utf8");
  const bufferB = Buffer.from(hashAttendu, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Le jeton qui autorise une seule chose : répondre à la question du transfert
 * pour **cette** demande.
 *
 * Après l'envoi d'une demande de logement, le visiteur n'a ni session ni code.
 * Or il doit pouvoir répondre « oui » ou « non » à « voulez-vous qu'on vienne
 * vous chercher à l'aéroport ? » — et cette réponse écrit à l'équipe et à lui.
 * Sans rien pour le prouver, n'importe qui connaissant une référence (six
 * chiffres, elle se devine) pourrait faire écrire à un inconnu et déranger
 * l'équipe.
 *
 * Le jeton est donc une signature de l'identifiant de la demande : sans état,
 * rien à stocker, rien à expirer, et **limité à cette action** — il ne donne ni
 * lecture, ni modification, ni accès à quoi que ce soit d'autre. Le préfixe
 * sépare ce domaine de celui des codes OTP, qui partagent la même clé : une
 * signature obtenue ici ne vaut rien là-bas, et inversement.
 *
 * L'API le remet à la création de la demande ; le site le garde dans le cookie
 * de confirmation, `httpOnly`, le temps d'une visite.
 */
export function jetonSuiteDemande(demandeId: string, secret = config.otpSecret): string {
  return createHmac("sha256", secret).update(`suite-demande:${demandeId}`).digest("hex");
}

/** Le jeton présenté correspond-il à cette demande ? Comparaison en temps constant. */
export function jetonSuiteValide(demandeId: string, jeton: unknown, secret = config.otpSecret): boolean {
  if (typeof jeton !== "string") return false;
  const attendu = Buffer.from(jetonSuiteDemande(demandeId, secret), "utf8");
  const recu = Buffer.from(jeton, "utf8");
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/**
 * Vérifie un code OTP en temps constant avec son empreinte HMAC-SHA-256.
 * Prend en charge la rotation de clé sans compromettre les OTP déjà émis.
 * Aucun fallback permissif : seuls les codes HMAC valides avec la clé active ou précédente sont acceptés.
 */
export function verifierOtpHash(
  code: string,
  hashAttendu: string,
  secret = config.otpSecret,
  secretsPourVerification: readonly string[] = config.otpSecretsPourVerification,
): boolean {
  // 1. Vérification primaire HMAC-SHA-256 avec secret serveur fourni ou actif
  if (verifierHmacUnitaire(code, hashAttendu, secret)) {
    return true;
  }

  // 2. Vérification secondaire avec les autres clés de rotation (si plusieurs clés configurées)
  if (Array.isArray(secretsPourVerification)) {
    for (const autreCle of secretsPourVerification) {
      if (autreCle !== secret && verifierHmacUnitaire(code, hashAttendu, autreCle)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcule l'empreinte cryptographique SHA-256 d'une chaîne avec un sel optionnel.
 */
export function hacherSha256(valeur: string, sel = SEL_PAR_DEFAUT): string {
  return createHash("sha256")
    .update(`${sel}:${valeur}`)
    .digest("hex");
}

/**
 * Calcule l'empreinte directe SHA-256 (pour les jetons à haute entropie).
 */
export function hacherJetonDirect(jeton: string): string {
  return createHash("sha256")
    .update(jeton)
    .digest("hex");
}

/**
 * Compare deux empreintes en temps constant pour éviter les attaques par canal auxiliaire (timing attacks).
 */
export function verifierSha256(valeur: string, hashAttendu: string, sel = SEL_PAR_DEFAUT): boolean {
  const hashCalcule = hacherSha256(valeur, sel);
  const bufferA = Buffer.from(hashCalcule, "utf8");
  const bufferB = Buffer.from(hashAttendu, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Compare deux empreintes directes en temps constant.
 */
export function verifierJetonDirect(jeton: string, hashAttendu: string): boolean {
  const hashCalcule = hacherJetonDirect(jeton);
  const bufferA = Buffer.from(hashCalcule, "utf8");
  const bufferB = Buffer.from(hashAttendu, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Génère un jeton de session cryptographiquement sûr (`tws_...`).
 */
export function genererJetonSession(): string {
  return `tws_${randomBytes(32).toString("hex")}`;
}

/**
 * Génère le jeton d'un lien d'accès à une demande (`twl_...`) : 256 bits
 * aléatoires, donc imprévisible. Seule son empreinte SHA-256 est conservée.
 */
export function genererJetonLienDemande(): string {
  return `twl_${randomBytes(32).toString("hex")}`;
}

/**
 * Génère un jeton de réponse partenaire non prédictible (`twp_...`).
 */
export function genererJetonPartenaire(): string {
  return `twp_${randomBytes(32).toString("hex")}`;
}

/**
 * Normalise un numéro de téléphone en ne conservant que les chiffres.
 */
export function normaliserTelephone(telephone: string): string {
  return telephone.replace(/\D/g, "");
}

/**
 * Normalise un identifiant (adresse e-mail en minuscules ou téléphone épuré).
 */
export function normaliserDestination(destination: string): string {
  const propre = destination.trim();
  if (propre.includes("@")) {
    return propre.toLowerCase();
  }
  return normaliserTelephone(propre);
}

/**
 * Extrait le jeton de session depuis les en-têtes Authorization, x-visiteur-id ou cookie.
 */
export function extraireJetonRequete(
  visiteurHeader?: string,
  authHeader?: string,
  cookieHeader?: string,
): string | undefined {
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, "").trim();
  }
  if (visiteurHeader) {
    return visiteurHeader.trim();
  }
  if (cookieHeader) {
    const match = cookieHeader.match(/teranga_visiteur=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

/* ───────────────────────── Mots de passe (scrypt) ───────────────────────── */

/**
 * Paramètres scrypt, encodés dans la valeur stockée.
 *
 * `N=16384, r=8, p=1` est le jeu recommandé par l'OWASP pour scrypt à usage
 * interactif : environ 16 Mio de mémoire et quelques dizaines de millisecondes
 * par vérification. Assez lent pour rendre une attaque hors-ligne coûteuse,
 * assez rapide pour une connexion.
 *
 * Les paramètres voyagent **avec** l'empreinte plutôt que d'être figés dans le
 * code : le jour où on les durcit, les mots de passe déjà enregistrés restent
 * vérifiables avec les anciens, et se réenregistrent au fil des connexions.
 * C'est la même logique que la rotation de clé OTP juste au-dessus.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_LONGUEUR = 64;
/** `maxmem` doit dépasser 128 · N · r, sinon Node refuse de calculer. */
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/** Longueur minimale d'un mot de passe. Court mais non négociable. */
export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;

/**
 * Un mot de passe provisoire, lisible à voix haute et impossible à deviner.
 *
 * Il part par e-mail à l'issue d'une demande envoyée sans compte : il sera donc
 * recopié à la main, parfois depuis un téléphone. D'où l'alphabet sans `0`, `O`,
 * `1`, `I` ni `l` — les quatre confusions qui font échouer une saisie — et les
 * groupes de quatre séparés par des traits.
 *
 * Seize caractères sur un alphabet de trente et un : près de quatre-vingts
 * bits, très au-delà de ce qu'une attaque en ligne peut parcourir — et la
 * connexion est de toute façon limitée en débit.
 *
 * Les octets au-delà du dernier multiple entier de l'alphabet sont rejetés
 * plutôt que repliés par un modulo : un reste mal réparti favoriserait les
 * premières lettres, et ce n'est pas du hasard qu'on veut presque.
 */
const ALPHABET_LISIBLE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genererMotDePasseProvisoire(longueur = 16): string {
  const plafond = 256 - (256 % ALPHABET_LISIBLE.length);
  const lettres: string[] = [];

  while (lettres.length < longueur) {
    for (const octet of randomBytes(longueur)) {
      if (octet >= plafond) continue;
      lettres.push(ALPHABET_LISIBLE[octet % ALPHABET_LISIBLE.length]);
      if (lettres.length === longueur) break;
    }
  }

  // Des groupes de quatre : c'est ainsi qu'on recopie un code sans se perdre.
  const groupes: string[] = [];
  for (let debut = 0; debut < longueur; debut += 4) {
    groupes.push(lettres.slice(debut, debut + 4).join(""));
  }
  return groupes.join("-");
}

/**
 * Hache un mot de passe avec un sel aléatoire propre à ce mot de passe.
 *
 * Le sel est tiré au hasard à chaque appel : deux comptes ayant choisi le même
 * mot de passe n'ont pas la même empreinte, et une table pré-calculée ne sert
 * à rien.
 *
 * Format : `scrypt$<N>$<r>$<p>$<sel hex>$<empreinte hex>`.
 */
export function hacherMotDePasse(motDePasse: string): string {
  const sel = randomBytes(16);
  const empreinte = scryptSync(motDePasse.normalize("NFKC"), sel, SCRYPT_LONGUEUR, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    sel.toString("hex"),
    empreinte.toString("hex"),
  ].join("$");
}

/**
 * Vérifie un mot de passe contre sa valeur stockée, en temps constant.
 *
 * Renvoie `false` — jamais une exception — sur une valeur stockée illisible :
 * un enregistrement corrompu doit refuser la connexion, pas faire tomber la
 * route d'authentification.
 */
export function verifierMotDePasse(motDePasse: string, valeurStockee?: string | null): boolean {
  if (!motDePasse || !valeurStockee) return false;

  const parties = valeurStockee.split("$");
  if (parties.length !== 6 || parties[0] !== "scrypt") return false;

  const [, nBrut, rBrut, pBrut, selHex, empreinteHex] = parties;
  const N = Number(nBrut);
  const r = Number(rBrut);
  const p = Number(pBrut);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Garde-fou : des paramètres absurdes dans la base ne doivent pas se traduire
  // par une allocation mémoire démesurée.
  if (N < 1024 || N > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let attendue: Buffer;
  let calculee: Buffer;
  try {
    attendue = Buffer.from(empreinteHex, "hex");
    if (attendue.length === 0) return false;
    calculee = scryptSync(motDePasse.normalize("NFKC"), Buffer.from(selHex, "hex"), attendue.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    return false;
  }

  if (attendue.length !== calculee.length) return false;
  return timingSafeEqual(attendue, calculee);
}

/**
 * Ce mot de passe est-il acceptable ?
 *
 * Volontairement sobre : une longueur minimale et le refus du vide. Pas
 * d'exigence de symboles — elle pousse à `Motdepasse1!`, que les listes de
 * mots de passe connus contiennent déjà. La longueur est ce qui compte.
 */
export function motDePasseAcceptable(motDePasse: string): boolean {
  if (typeof motDePasse !== "string") return false;
  const propre = motDePasse.normalize("NFKC");
  if (propre.trim().length === 0) return false;
  return propre.length >= LONGUEUR_MINIMALE_MOT_DE_PASSE;
}
