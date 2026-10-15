import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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
