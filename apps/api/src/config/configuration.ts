/**
 * Configuration de l'API, validée et chargée au démarrage.
 *
 * Toute valeur qui change entre les environnements passe par ici. Rien n'est
 * lu via `process.env` de façon désordonnée ailleurs dans le code : une valeur
 * obligatoire manquante fait échouer immédiatement le démarrage.
 */
import { MOYENS_ACOMPTE } from "@teranga/contracts";
import type {
  BeneficiaireAcompte,
  CompteMobileMoney,
  MoyenAcompte,
} from "@teranga/contracts";

import { pourcentageValide } from "../modules/acomptes/calcul";

function requis(nom: string, defaut?: string, env: NodeJS.ProcessEnv = process.env): string {
  const brute = env[nom];
  const estRenseigne = brute !== undefined && brute.trim() !== "";
  const valeur = estRenseigne ? brute.trim() : defaut;
  if (valeur === undefined || valeur.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
}

/** Une variable facultative : rendue nettoyée, ou `undefined` si vide. */
function optionnel(nom: string, env: NodeJS.ProcessEnv): string | undefined {
  const brute = env[nom];
  if (brute === undefined) return undefined;
  const valeur = brute.trim();
  return valeur === "" ? undefined : valeur;
}

/** L'état de la configuration bancaire, tel qu'on peut le dire sans rien livrer. */
export type EtatCoordonneesBancaires = "absent" | "incomplet" | "defini";

export interface ConfigAcompte {
  /**
   * L'acompte peut-il être réclamé ?
   *
   * **Faux par défaut, et il faut trois clés pour l'ouvrir** : le verrou
   * explicite `ACOMPTE_ACTIF`, un taux exploitable, et des coordonnées
   * bancaires complètes. Chacune a son propre responsable — la revue juridique
   * pour le verrou, le produit pour le taux, la trésorerie pour le compte — et
   * aucune ne peut être satisfaite par accident.
   *
   * C'est la règle que tout ce dépôt applique déjà ailleurs : une variable
   * absente ferme la porte, elle ne l'ouvre pas. Ici elle garde de l'argent.
   */
  actif: boolean;
  /** Le taux retenu, en pourcents entiers. `undefined` = non configuré. */
  pourcentage: number | undefined;
  etatCoordonnees: EtatCoordonneesBancaires;
  /**
   * Le compte bénéficiaire, **seulement s'il est complet**.
   *
   * Des coordonnées à moitié renseignées ne sont pas exposées du tout : un
   * e-mail portant un IBAN sans BIC, ou un BIC sans titulaire, est un virement
   * qui n'arrivera pas — et un visiteur qui croit avoir payé.
   */
  beneficiaire: BeneficiaireAcompte | undefined;
  /**
   * Les moyens acceptés. Absent = le virement seul, comme avant que Mobile
   * Money existe : une configuration qui ne les nomme pas ne change pas.
   * Chaque moyen listé doit être complètement configuré pour ouvrir l'acompte.
   */
  moyens?: MoyenAcompte[];
  /** Les comptes Mobile Money **complets** — un numéro sans titulaire n'est pas exposé. */
  mobileMoney?: CompteMobileMoney[];
  /** Consignes libres jointes à l'e-mail d'instructions, 500 caractères au plus. */
  instructions?: string;
}

const LONGUEUR_MAXIMALE_INSTRUCTIONS = 500;

/**
 * Un numéro Mobile Money tel qu'on le lira dans un e-mail : séparateurs ôtés,
 * « + » initial conservé. Le contrôle est de forme (8 à 15 chiffres, norme
 * E.164) ; l'opérateur reste seul juge de l'existence du numéro.
 */
function normaliserNumero(brut: string): string | undefined {
  const propre = brut.replace(/[\s.\-()]/g, "");
  return /^\+?\d{8,15}$/.test(propre) ? propre : undefined;
}

interface LectureMobileMoney {
  compte?: CompteMobileMoney;
  etat: "absent" | "incomplet" | "defini";
  /** Le numéro est présent mais n'a pas la forme d'un numéro. */
  numeroInvalide: boolean;
}

function lireMobileMoney(
  operateur: CompteMobileMoney["operateur"],
  prefixe: string,
  env: NodeJS.ProcessEnv,
): LectureMobileMoney {
  const brutNumero = optionnel(`${prefixe}_NUMERO`, env);
  const titulaire = optionnel(`${prefixe}_TITULAIRE`, env);
  const renseignes = [brutNumero, titulaire].filter((v) => v !== undefined).length;
  const numero = brutNumero === undefined ? undefined : normaliserNumero(brutNumero);
  const numeroInvalide = brutNumero !== undefined && numero === undefined;

  if (renseignes === 0) return { etat: "absent", numeroInvalide: false };
  if (renseignes < 2 || numeroInvalide) return { etat: "incomplet", numeroInvalide };
  return { etat: "defini", numeroInvalide: false, compte: { operateur, numero: numero!, titulaire: titulaire! } };
}

const PREFIXES_MOBILE_MONEY: Record<CompteMobileMoney["operateur"], string> = {
  wave: "ACOMPTE_WAVE",
  "orange-money": "ACOMPTE_ORANGE_MONEY",
};

/**
 * La configuration de l'acompte par virement, fermée par défaut.
 *
 * Elle ne lève **que** si quelqu'un a explicitement réclamé l'acompte
 * (`ACOMPTE_ACTIF=true`) sans fournir de quoi le réclamer. Dans ce cas-là, le
 * silence serait le pire des choix : on découvrirait des semaines plus tard
 * que personne n'a jamais reçu d'instructions de virement. À l'inverse, une
 * variable simplement absente ne doit pas empêcher l'API de démarrer : tout le
 * reste du produit fonctionne sans acompte, comme aujourd'hui.
 */
function chargerAcompte(env: NodeJS.ProcessEnv): ConfigAcompte {
  const reclame = (env.ACOMPTE_ACTIF ?? "").trim().toLowerCase() === "true";

  const brutPourcentage = optionnel("ACOMPTE_POURCENTAGE", env);
  const pourcentage = brutPourcentage === undefined ? undefined : Number(brutPourcentage);
  const tauxExploitable = pourcentageValide(pourcentage);

  // Le **délai** n'est pas ici, et c'est délibéré : il dépend du genre de la
  // demande — douze heures pour un logement, trois pour une location — et il
  // vit dans `DELAIS_ACOMPTE_HEURES`, avec l'éligibilité qu'il détermine. Une
  // variable unique `ACOMPTE_DELAI_HEURES` existait : elle imposait silencieusement
  // les douze heures du logement à la location. Elle est retirée plutôt que
  // conservée à côté, pour qu'elle ne puisse pas les réintroduire.

  // L'IBAN est normalisé — sans espaces, en majuscules — parce qu'il sera
  // recopié par un visiteur dans un formulaire de virement, et que « SN12 3456 »
  // et « sn123456 » doivent désigner le même compte.
  const titulaire = optionnel("ACOMPTE_BANQUE_TITULAIRE", env);
  const banque = optionnel("ACOMPTE_BANQUE_NOM", env);
  const iban = optionnel("ACOMPTE_BANQUE_IBAN", env)?.replace(/\s+/g, "").toUpperCase();
  const bic = optionnel("ACOMPTE_BANQUE_BIC", env)?.replace(/\s+/g, "").toUpperCase();

  const champs = [titulaire, banque, iban, bic];
  const renseignes = champs.filter((valeur) => valeur !== undefined).length;

  // Contrôle de **forme** seulement : la plage 15–34 caractères alphanumériques
  // est celle de la norme ISO 13616, toutes zones confondues. La clé de
  // contrôle n'est délibérément pas vérifiée — se tromper sur elle rejetterait
  // un compte valide, ce qui est plus grave que de laisser passer une coquille
  // que le premier virement d'essai révélera.
  const ibanDeForme = iban !== undefined && /^[A-Z0-9]{15,34}$/.test(iban);

  const etatCoordonnees: EtatCoordonneesBancaires =
    renseignes === 0 ? "absent" : renseignes === champs.length && ibanDeForme ? "defini" : "incomplet";

  // Les moyens acceptés : le virement seul tant que rien n'est dit. Une valeur
  // inconnue n'est jamais ignorée en silence — elle fermerait un moyen que
  // quelqu'un croit ouvert, ou en ouvrirait un autre.
  const brutMoyens = optionnel("ACOMPTE_MOYENS", env);
  const nomsMoyens = brutMoyens
    ? brutMoyens.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean)
    : ["virement"];
  const moyensInconnus = nomsMoyens.filter((m) => !(MOYENS_ACOMPTE as readonly string[]).includes(m));
  const moyens = [...new Set(nomsMoyens.filter((m): m is MoyenAcompte =>
    (MOYENS_ACOMPTE as readonly string[]).includes(m)))];

  const lectures = {
    wave: lireMobileMoney("wave", PREFIXES_MOBILE_MONEY.wave, env),
    "orange-money": lireMobileMoney("orange-money", PREFIXES_MOBILE_MONEY["orange-money"], env),
  } as const;
  const mobileMoney = (["wave", "orange-money"] as const)
    .map((operateur) => lectures[operateur].compte)
    .filter((compte): compte is CompteMobileMoney => compte !== undefined);

  const brutInstructions = optionnel("ACOMPTE_INSTRUCTIONS", env);
  const instructionsTropLongues =
    brutInstructions !== undefined && brutInstructions.length > LONGUEUR_MAXIMALE_INSTRUCTIONS;

  const virementPret = !moyens.includes("virement") || etatCoordonnees === "defini";
  const mobilePret = (["wave", "orange-money"] as const).every(
    (operateur) => !moyens.includes(operateur) || lectures[operateur].etat === "defini",
  );
  const actif =
    reclame &&
    tauxExploitable &&
    moyens.length > 0 &&
    moyensInconnus.length === 0 &&
    !instructionsTropLongues &&
    virementPret &&
    mobilePret;

  if (reclame && !actif) {
    const manques: string[] = [];
    if (moyensInconnus.length > 0) {
      manques.push(
        `ACOMPTE_MOYENS contient « ${moyensInconnus.join(", ")} » : seuls ${MOYENS_ACOMPTE.join(", ")} sont acceptés`,
      );
    } else if (moyens.length === 0) {
      manques.push("ACOMPTE_MOYENS ne nomme aucun moyen de paiement");
    }
    if (instructionsTropLongues) {
      manques.push(`ACOMPTE_INSTRUCTIONS dépasse ${LONGUEUR_MAXIMALE_INSTRUCTIONS} caractères`);
    }
    for (const operateur of ["wave", "orange-money"] as const) {
      if (!moyens.includes(operateur)) continue;
      const lecture = lectures[operateur];
      const prefixe = PREFIXES_MOBILE_MONEY[operateur];
      if (lecture.etat === "absent") {
        manques.push(`${operateur} est accepté mais ${prefixe}_NUMERO et ${prefixe}_TITULAIRE sont absents`);
      } else if (lecture.numeroInvalide) {
        manques.push(`${prefixe}_NUMERO n'a pas la forme d'un numéro (8 à 15 chiffres)`);
      } else if (lecture.etat === "incomplet") {
        manques.push(`${prefixe}_NUMERO et ${prefixe}_TITULAIRE sont requis ensemble`);
      }
    }
    if (!tauxExploitable) {
      manques.push(
        brutPourcentage === undefined
          ? "ACOMPTE_POURCENTAGE est absente"
          : `ACOMPTE_POURCENTAGE vaut « ${brutPourcentage} », or le taux doit être un entier de 1 à 100`,
      );
    }
    if (!virementPret && etatCoordonnees === "absent") {
      manques.push(
        "aucune coordonnée bancaire n'est renseignée (ACOMPTE_BANQUE_TITULAIRE, " +
          "ACOMPTE_BANQUE_NOM, ACOMPTE_BANQUE_IBAN, ACOMPTE_BANQUE_BIC)",
      );
    } else if (!virementPret && etatCoordonnees === "incomplet") {
      manques.push(
        iban !== undefined && !ibanDeForme
          ? "ACOMPTE_BANQUE_IBAN n'a pas la forme d'un IBAN (15 à 34 caractères alphanumériques)"
          : "les coordonnées bancaires sont incomplètes : les quatre champs sont requis",
      );
    }
    throw new Error(
      `ACOMPTE_ACTIF=true mais l'acompte ne peut pas être réclamé : ${manques.join(" ; ")}.`,
    );
  }

  return {
    actif,
    pourcentage: tauxExploitable ? pourcentage : undefined,
    etatCoordonnees,
    beneficiaire:
      etatCoordonnees === "defini"
        ? { titulaire: titulaire!, banque: banque!, iban: iban!, bic: bic! }
        : undefined,
    moyens,
    mobileMoney,
    instructions: brutInstructions !== undefined && !instructionsTropLongues ? brutInstructions : undefined,
  };
}

export function chargerConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const isProd = (env.NODE_ENV ?? "development") === "production";
  const requisEnv = (nom: string, defaut?: string) => requis(nom, defaut, env);

  // Gestion de la clé active et des clés précédentes pour rotation sécurisée sans rupture
  const brutOtp = env.OTP_SECRET?.trim();
  const brutPrecedent = env.OTP_PREVIOUS_SECRET?.trim();
  if (isProd && (!brutOtp || brutOtp === "")) {
    throw new Error("Variable d'environnement manquante : OTP_SECRET");
  }

  const secretsOtp: string[] = [];
  if (brutOtp) {
    for (const cleBrute of brutOtp.split(",")) {
      const cle = cleBrute.trim();
      if (cle && !secretsOtp.includes(cle)) {
        secretsOtp.push(cle);
      }
    }
  }
  if (brutPrecedent) {
    for (const cleBrute of brutPrecedent.split(",")) {
      const cle = cleBrute.trim();
      if (cle && !secretsOtp.includes(cle)) {
        secretsOtp.push(cle);
      }
    }
  }
  if (secretsOtp.length === 0) {
    const defautDev = "teranga-dev-otp-hmac-secret-key-32chars-min-2026";
    secretsOtp.push(defautDev);
  }

  // Les accès de démonstration — compte `visiteur-demo`, code OTP fixe,
  // résolution d'une session depuis un simple identifiant de compte — sont une
  // commodité de développement, jamais un mécanisme d'authentification.
  //
  // Ils sont donc à **refus par défaut** : il faut les réclamer explicitement
  // par `AUTORISER_COMPTES_DEMO=true`, et `NODE_ENV=production` les referme
  // quoi qu'il arrive. Le double verrou n'est pas une ceinture de plus : en
  // production, ces accès étaient restés ouverts parce que le code ne lisait
  // que `NODE_ENV`, et que cette variable ne valait pas ce qu'on croyait dans
  // le conteneur. Une variable d'environnement absente doit fermer la porte,
  // pas l'ouvrir.
  const demoReclamee = (env.AUTORISER_COMPTES_DEMO ?? "").trim().toLowerCase() === "true";
  const autoriserComptesDemo = demoReclamee && !isProd;

  return {
    port: Number(requisEnv("PORT", "3001")),
    environnement: requisEnv("NODE_ENV", "development"),
    /** `true` seulement si NODE_ENV n'est pas `production`. Jamais une garantie à lui seul. */
    estProduction: isProd,
    /**
     * Les raccourcis de démonstration sont-ils ouverts ? Refus par défaut.
     * C'est **cette** valeur que le code d'authentification doit consulter,
     * jamais `environnement` directement.
     */
    autoriserComptesDemo,
    /** `true` quand quelqu'un a réclamé le mode démo mais que la production l'a refusé : à journaliser. */
    demoRefuseeEnProduction: demoReclamee && isProd,
    /** Origines autorisées à appeler l'API, séparées par des virgules. */
    originesAutorisees: requisEnv(
      "ORIGINES_AUTORISEES",
      "http://localhost:3000,http://localhost:3100,https://teranga-way.com,https://www.teranga-way.com",
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** Durée de validité d'un jeton de réponse partenaire, en minutes (PAR-11). */
    dureeJetonMinutes: Number(requisEnv("DUREE_JETON_MINUTES", "120")),
    /** Délai de réponse accordé au partenaire sur une demande, en minutes. */
    delaiReponseMinutes: Number(requisEnv("DELAI_REPONSE_MINUTES", "120")),
    /** Préavis minimal pour une prise en charge, en heures (§B.3). */
    delaiMinimumHeures: Number(requisEnv("DELAI_MINIMUM_HEURES", "2")),
    /** Configuration Resend & e-mails transactionnels (obligatoire en production) */
    resendApiKey: isProd
      ? requisEnv("RESEND_API_KEY")
      : (env.RESEND_API_KEY?.trim() ?? ""),
    emailFrom: requisEnv("EMAIL_FROM", "Teranga Way <auth@teranga-way.com>"),
    appUrl: requisEnv("APP_URL", isProd ? "https://teranga-way.com" : "http://localhost:3000"),
    /**
     * Le trafic arrive-t-il par Cloudflare ?
     *
     * Ouvert, l'API retient `CF-Connecting-IP` comme adresse du visiteur. Cet
     * en-tête est posé par Cloudflare et **n'importe qui peut l'inventer** en
     * frappant directement l'IP du serveur : ne l'ouvrir qu'une fois le
     * pare-feu du VPS restreint aux plages de Cloudflare. Sans cela, on offre
     * à l'attaquant le moyen de changer d'adresse à volonté, donc d'échapper
     * à la limitation des codes.
     *
     * Fermé par défaut : une variable absente ne doit jamais ouvrir une porte.
     */
    derriereCloudflare: (env.DERRIERE_CLOUDFLARE ?? "").trim().toLowerCase() === "true",
    /**
     * Les adresses qui ouvrent le backoffice, séparées par des virgules.
     *
     * Sur Postgres, c'est le rôle du compte qui fait foi : cette liste ne sert
     * qu'au dépôt en mémoire, où il n'y a pas de table des comptes. Vide par
     * défaut — sans variable, personne n'entre.
     */
    adminEmails: (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    /**
     * L'acompte par virement bancaire. Fermé par défaut.
     *
     * Les règles qu'il porte sont **provisoires** : la collecte réelle d'un
     * acompte attend une validation juridique, et c'est `ACOMPTE_ACTIF` qui
     * tient cette porte. Tant qu'elle n'est pas posée à `true`, aucun montant
     * ne peut être réclamé à personne, même si le reste est renseigné.
     */
    acompte: chargerAcompte(env),
    /** Clé secrète dédiée pour HMAC-SHA-256 des codes OTP (clé active) */
    otpSecret: secretsOtp[0],
    /** Liste ordonnée de toutes les clés autorisées pour vérification (rotation) */
    otpSecretsPourVerification: secretsOtp,
  } as const;
}

export const config = chargerConfiguration();

export type Config = ReturnType<typeof chargerConfiguration>;
