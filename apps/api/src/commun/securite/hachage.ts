import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SEL_PAR_DEFAUT = process.env.OTP_SECRET ?? "teranga-securite-sel-2026";

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
