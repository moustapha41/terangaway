import { apiVerifierOtp } from "@/lib/api/ecriture";
import { ErreurApi } from "@/lib/api/http";
import { ouvrirSessionVerifiee } from "./actions";

/**
 * Vérifier un code et ouvrir la session, en un seul endroit.
 *
 * Les trois tunnels — logement, transport, service — faisaient chacun leur
 * copie de cette séquence. Trois copies, c'est trois occasions de diverger : la
 * première corrigée, les deux autres oubliées. La voici une fois.
 *
 * Le diagnostic de l'erreur se lit sur le **code** stable renvoyé par l'API, et
 * non sur le texte du message. L'ancien code cherchait `"expir"` dans le
 * message : traduire le message, ou le reformuler, suffisait à faire passer un
 * code expiré pour un code faux.
 */
export type EchecVerification =
  | { erreur: "code_invalide"; raison: "faux" | "expire"; message?: string }
  | { erreur: "trop_de_tentatives"; message: string }
  | { erreur: "session"; message: string };

export type ResultatVerification = { ok: true } | { ok: false; echec: EchecVerification };

/** Message affichable quand la session n'a pas pu s'ouvrir malgré un code correct. */
const SESSION_IMPOSSIBLE =
  "Votre code est correct, mais la session n'a pas pu être ouverte. Veuillez réessayer dans un instant.";

export async function verifierCodeEtOuvrirSession(
  email: string,
  code: string,
): Promise<ResultatVerification> {
  let verification: { visiteurId: string; token?: string };

  try {
    verification = await apiVerifierOtp(email, code);
  } catch (err) {
    return { ok: false, echec: classer(err) };
  }

  // Un code correct qui n'ouvre pas de session n'est pas un code refusé : le
  // distinguer évite d'envoyer le visiteur ressaisir un code qui était bon.
  const ouverte = await ouvrirSessionVerifiee(verification);
  if (!ouverte) {
    return { ok: false, echec: { erreur: "session", message: SESSION_IMPOSSIBLE } };
  }

  return { ok: true };
}

function classer(err: unknown): EchecVerification {
  const code = err instanceof ErreurApi ? err.code : undefined;
  const message = err instanceof Error ? err.message : undefined;

  switch (code) {
    case "CODE_EXPIRE":
      return { erreur: "code_invalide", raison: "expire", message };
    case "CODE_INVALIDE":
    case "CODE_DEJA_UTILISE":
      return { erreur: "code_invalide", raison: "faux", message };
    case "TENTATIVES_DEPASSEES":
      return {
        erreur: "trop_de_tentatives",
        message:
          message ??
          "Trop de tentatives sur ce code. Demandez un nouveau code de vérification.",
      };
    default:
      // Panne réseau, API injoignable, erreur inattendue : ce n'est pas la
      // faute du code saisi, et le dire autrement ferait tourner le visiteur
      // en rond sur une saisie qui était peut-être correcte.
      return {
        erreur: "session",
        message:
          message ??
          "La vérification n'a pas abouti. Veuillez réessayer dans un instant.",
      };
  }
}
