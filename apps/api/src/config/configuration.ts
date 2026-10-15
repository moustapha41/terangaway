/**
 * Configuration de l'API, validée et chargée au démarrage.
 *
 * Toute valeur qui change entre les environnements passe par ici. Rien n'est
 * lu via `process.env` de façon désordonnée ailleurs dans le code : une valeur
 * obligatoire manquante fait échouer immédiatement le démarrage.
 */
function requis(nom: string, defaut?: string, env: NodeJS.ProcessEnv = process.env): string {
  const brute = env[nom];
  const estRenseigne = brute !== undefined && brute.trim() !== "";
  const valeur = estRenseigne ? brute.trim() : defaut;
  if (valeur === undefined || valeur.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
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
    /** Clé secrète dédiée pour HMAC-SHA-256 des codes OTP (clé active) */
    otpSecret: secretsOtp[0],
    /** Liste ordonnée de toutes les clés autorisées pour vérification (rotation) */
    otpSecretsPourVerification: secretsOtp,
  } as const;
}

export const config = chargerConfiguration();

export type Config = ReturnType<typeof chargerConfiguration>;
