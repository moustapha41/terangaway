"use server";

import { redirect } from "next/navigation";
import {
  apiInscrire,
  apiRenvoyerCodeInscription,
  apiVerifierInscription,
  apiConnexionMotDePasse,
} from "@/lib/api/ecriture";
import { apiMockActive, ErreurApi } from "@/lib/api/http";
import { CODE_DE_DEMONSTRATION } from "@/mocks/api";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { ouvrirSession, ouvrirSessionVerifiee } from "./actions";
import { resoudreDestination } from "./destination";
import {
  effacerInscriptionEnAttente,
  lireInscriptionEnAttente,
  poserInscriptionEnAttente,
} from "./inscription-en-attente";
import {
  LONGUEUR_MAXIMALE_MOT_DE_PASSE,
  LONGUEUR_MINIMALE_MOT_DE_PASSE,
} from "./regles-mot-de-passe";

/**
 * Le parcours d'inscription, côté serveur.
 *
 * Trois étapes, trois actions, et une règle qui les relie : **aucune session
 * n'est ouverte avant que le code reçu par e-mail ne soit vérifié par l'API.**
 * `inscrireAction` ne pose qu'un cookie d'attente, qui n'authentifie rien.
 *
 * Les validations sont écrites deux fois, ici et dans `ServiceComptes` côté
 * API. Ce n'est pas une redite inutile : celle du navigateur est un confort
 * d'affichage, celle d'ici protège l'action si elle est appelée directement, et
 * celle de l'API protège la base. Seule la dernière est une garantie.
 */

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ChampInscription = "nom" | "email" | "motDePasse" | "confirmation";

export interface EtatInscription {
  /** Une erreur par champ, pour l'afficher au bon endroit. */
  erreurs?: Partial<Record<ChampInscription, string>>;
  /** Erreur globale, affichée en bandeau. */
  message?: string;
  /** L'adresse a déjà un compte : l'écran propose alors de se connecter. */
  dejaInscrit?: boolean;
}

export interface EtatVerification {
  erreur?: "code" | "expire" | "tentatives" | "introuvable" | "serveur";
  message?: string;
}

/* ───────────────────────────── 1. Inscription ───────────────────────────── */

export async function inscrireAction(
  _precedent: EtatInscription,
  formData: FormData,
): Promise<EtatInscription> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const suiteBrute = String(formData.get("suite") ?? "");
  const langue: Langue = estLangue(String(formData.get("langue") ?? ""))
    ? (String(formData.get("langue")) as Langue)
    : "fr";

  const erreurs: Partial<Record<ChampInscription, string>> = {};

  if (nom.length < 2) erreurs.nom = "Indiquez votre nom complet.";
  if (nom.length > 120) erreurs.nom = "Ce nom est trop long.";
  if (!EMAIL_VALIDE.test(email)) erreurs.email = "Indiquez une adresse e-mail valide.";
  if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
    erreurs.motDePasse = `Le mot de passe doit comporter au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`;
  } else if (motDePasse.length > LONGUEUR_MAXIMALE_MOT_DE_PASSE) {
    erreurs.motDePasse = "Ce mot de passe est trop long.";
  }
  if (confirmation !== motDePasse) {
    erreurs.confirmation = "Les deux mots de passe ne correspondent pas.";
  }

  if (Object.keys(erreurs).length > 0) return { erreurs };

  if (!apiMockActive()) {
    try {
      await apiInscrire({ nom, email, motDePasse });
    } catch (err) {
      return erreurInscription(err);
    }
  }

  // Le cookie d'attente retient l'adresse et la destination, hors de l'URL.
  await poserInscriptionEnAttente({ email, suite: suiteBrute || undefined });

  // `redirect` lève par conception : rien ne doit suivre.
  redirect(`/${langue}/inscription/verification`);
}

function erreurInscription(err: unknown): EtatInscription {
  const code = err instanceof ErreurApi ? err.code : undefined;
  const message = err instanceof Error ? err.message : undefined;

  switch (code) {
    case "EMAIL_DEJA_UTILISE":
      return {
        dejaInscrit: true,
        erreurs: { email: "Un compte existe déjà avec cette adresse e-mail." },
      };
    case "EMAIL_INVALIDE":
      return { erreurs: { email: message ?? "Adresse e-mail invalide." } };
    case "MOT_DE_PASSE_INVALIDE":
      return { erreurs: { motDePasse: message ?? "Ce mot de passe n'est pas accepté." } };
    case "NOM_INVALIDE":
      return { erreurs: { nom: message ?? "Indiquez votre nom complet." } };
    case "DELAI_ATTENTE":
    case "QUOTA_DEPASSE":
    case "QUOTA_IP_DEPASSE":
      // L'API refuse d'envoyer un nouveau code tout de suite. Le dire, plutôt
      // que de laisser croire à une erreur de saisie.
      return { message: message ?? "Trop de demandes. Réessayez dans quelques minutes." };
    default:
      return {
        message:
          message ?? "L'inscription n'a pas pu aboutir. Réessayez dans un instant.",
      };
  }
}

/* ──────────────────────────── 2. Vérification ───────────────────────────── */

export async function verifierInscriptionAction(
  _precedent: EtatVerification,
  formData: FormData,
): Promise<EtatVerification> {
  const code = String(formData.get("code") ?? "").trim();
  const langue: Langue = estLangue(String(formData.get("langue") ?? ""))
    ? (String(formData.get("langue")) as Langue)
    : "fr";

  if (!/^\d{6}$/.test(code)) {
    return { erreur: "code", message: "Saisissez les six chiffres du code." };
  }

  // L'adresse vient du cookie, jamais du formulaire : sinon n'importe qui
  // pourrait soumettre l'adresse d'un autre avec un code deviné.
  const enAttente = await lireInscriptionEnAttente();
  if (!enAttente) {
    return {
      erreur: "introuvable",
      message: "Votre inscription a expiré. Reprenez-la depuis le début.",
    };
  }

  if (apiMockActive()) {
    if (code !== CODE_DE_DEMONSTRATION) {
      return { erreur: "code", message: "Ce code ne correspond pas." };
    }
    const jetonMock = `session-mock-${Buffer.from(enAttente.email).toString("hex")}`;
    await ouvrirSession(jetonMock);
  } else {
    try {
      const verification = await apiVerifierInscription(enAttente.email, code);
      const ouverte = await ouvrirSessionVerifiee(verification);
      if (!ouverte) {
        return {
          erreur: "serveur",
          message:
            "Votre code est correct, mais la session n'a pas pu être ouverte. Réessayez dans un instant.",
        };
      }
    } catch (err) {
      return erreurVerification(err);
    }
  }

  await effacerInscriptionEnAttente();

  // La destination demandée avant l'inscription, si elle est interne et sûre.
  redirect(resoudreDestination(enAttente.suite, langue));
}

function erreurVerification(err: unknown): EtatVerification {
  const code = err instanceof ErreurApi ? err.code : undefined;
  const message = err instanceof Error ? err.message : undefined;

  switch (code) {
    case "CODE_EXPIRE":
      return { erreur: "expire", message: message ?? "Ce code a expiré. Demandez-en un nouveau." };
    case "CODE_INVALIDE":
    case "CODE_DEJA_UTILISE":
      return { erreur: "code", message: message ?? "Ce code ne correspond pas." };
    case "TENTATIVES_DEPASSEES":
      return {
        erreur: "tentatives",
        message: message ?? "Trop de tentatives. Demandez un nouveau code.",
      };
    case "INSCRIPTION_INTROUVABLE":
      return {
        erreur: "introuvable",
        message: message ?? "Aucune inscription en attente. Reprenez l'inscription.",
      };
    default:
      return {
        erreur: "serveur",
        message: message ?? "La vérification n'a pas abouti. Réessayez dans un instant.",
      };
  }
}

/* ───────────────────────────── 3. Renvoi du code ─────────────────────────── */

export type ResultatRenvoi =
  | { succes: true; delaiAttenteSecondes: number }
  | { succes: false; message: string };

export async function renvoyerCodeInscriptionAction(): Promise<ResultatRenvoi> {
  const enAttente = await lireInscriptionEnAttente();
  if (!enAttente) {
    return { succes: false, message: "Votre inscription a expiré. Reprenez-la depuis le début." };
  }

  if (apiMockActive()) {
    return { succes: true, delaiAttenteSecondes: 60 };
  }

  try {
    const resultat = await apiRenvoyerCodeInscription(enAttente.email);
    return { succes: true, delaiAttenteSecondes: resultat.delaiAttenteSecondes ?? 60 };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Le code n'a pas pu être renvoyé. Réessayez dans un instant.";
    return { succes: false, message };
  }
}

/** Repartir corriger l'adresse : on oublie l'inscription en attente. */
export async function abandonnerInscriptionAction(langue: string): Promise<void> {
  await effacerInscriptionEnAttente();
  const cible: Langue = estLangue(langue) ? langue : "fr";
  redirect(`/${cible}/inscription`);
}

/* ─────────────────── 4. Connexion par mot de passe ─────────────────── */

export interface EtatConnexionMotDePasse {
  erreur?: "identifiants" | "non_verifie" | "tentatives" | "serveur";
  message?: string;
}

export async function connexionMotDePasseAction(
  _precedent: EtatConnexionMotDePasse,
  formData: FormData,
): Promise<EtatConnexionMotDePasse> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const suite = String(formData.get("suite") ?? "");
  const langue: Langue = estLangue(String(formData.get("langue") ?? ""))
    ? (String(formData.get("langue")) as Langue)
    : "fr";

  if (!EMAIL_VALIDE.test(email) || !motDePasse) {
    return {
      erreur: "identifiants",
      message: "L'adresse e-mail ou le mot de passe ne correspond pas.",
    };
  }

  if (apiMockActive()) {
    // Sans API, aucun mot de passe n'est vérifiable : on refuse plutôt que de
    // laisser croire à une authentification.
    return {
      erreur: "serveur",
      message: "La connexion par mot de passe demande l'API. Utilisez le code par e-mail.",
    };
  }

  try {
    const resultat = await apiConnexionMotDePasse(email, motDePasse);
    const ouverte = await ouvrirSessionVerifiee(resultat);
    if (!ouverte) {
      return {
        erreur: "serveur",
        message: "La session n'a pas pu être ouverte. Réessayez dans un instant.",
      };
    }
  } catch (err) {
    const code = err instanceof ErreurApi ? err.code : undefined;
    const message = err instanceof Error ? err.message : undefined;

    if (code === "COMPTE_NON_VERIFIE") {
      // Mot de passe bon, adresse jamais confirmée : on rouvre une attente de
      // vérification sur cette adresse plutôt que de laisser la personne devant
      // un refus sans issue.
      await poserInscriptionEnAttente({ email, suite: suite || undefined });
      return { erreur: "non_verifie", message };
    }
    if (code === "TENTATIVES_DEPASSEES") {
      return { erreur: "tentatives", message };
    }
    return {
      erreur: "identifiants",
      message: message ?? "L'adresse e-mail ou le mot de passe ne correspond pas.",
    };
  }

  redirect(resoudreDestination(suite, langue));
}
