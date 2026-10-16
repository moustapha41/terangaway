import "server-only";

/**
 * Connexion Google — la moitié qui vit dans le site.
 *
 * Le flux est le code d'autorisation, pas le jeton implicite : le navigateur ne
 * reçoit qu'un code à usage unique, et c'est le serveur Next qui l'échange
 * contre l'identité, par une requête directe à Google. Le secret client ne
 * quitte donc jamais la machine.
 *
 * `server-only` n'est pas décoratif : importer ce fichier depuis un composant
 * client ferait partir `GOOGLE_CLIENT_SECRET` dans le paquet du navigateur.
 * L'import échoue à la compilation plutôt qu'à la mise en ligne.
 */

const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETON = "https://oauth2.googleapis.com/token";
const EMETTEURS = ["https://accounts.google.com", "accounts.google.com"];

/** Nom du cookie qui retient l'aller pendant que le visiteur est chez Google. */
export const COOKIE_OAUTH = "teranga_oauth";
/** Dix minutes : le temps de choisir un compte, pas celui d'oublier l'onglet. */
export const DUREE_OAUTH_SECONDES = 600;

export interface ConfigurationGoogle {
  clientId: string;
  clientSecret: string;
}

/**
 * La configuration, ou `null` si elle manque.
 *
 * Rien ne lève ici : sans identifiants, le bouton Google n'est tout simplement
 * pas proposé. Le site doit démarrer et servir ses pages même quand Google
 * n'est pas encore configuré — c'est l'état de toutes les installations
 * locales.
 */
export function configurationGoogle(): ConfigurationGoogle | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleConfigure(): boolean {
  return configurationGoogle() !== null;
}

/**
 * L'adresse de retour, telle que Google la vérifiera.
 *
 * Elle doit correspondre **au caractère près** à l'une des URI déclarées dans
 * la console. On la construit depuis l'origine de la requête reçue, pour que le
 * même code serve en local (`http://localhost:3000`) et en ligne
 * (`https://teranga-way.com`) sans variable de plus.
 *
 * Derrière le Traefik de Dokploy, la requête arrive en clair sur le port 3100 :
 * c'est `x-forwarded-proto` et `x-forwarded-host` qui portent l'adresse vue par
 * le visiteur. Les lire évite de renvoyer Google vers `http://web:3100`.
 */
export function adresseDeRetour(requete: Request): string {
  const entetes = requete.headers;
  const url = new URL(requete.url);
  const protocole = entetes.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const hote = entetes.get("x-forwarded-host")?.split(",")[0]?.trim() || entetes.get("host") || url.host;
  return `${protocole}://${hote}/api/auth/google/callback`;
}

export function urlAutorisation(options: {
  clientId: string;
  redirection: string;
  state: string;
  nonce: string;
}): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirection,
    response_type: "code",
    // Le strict nécessaire : qui est la personne, et son adresse. Rien qui
    // demande l'accès à ses messages ou à son agenda — c'est aussi ce qui
    // dispense l'application d'une validation par Google.
    scope: "openid email profile",
    state: options.state,
    nonce: options.nonce,
    // Toujours proposer le choix du compte : sur un ordinateur partagé, un
    // visiteur déjà connecté à Google serait sinon identifié sans l'avoir voulu.
    prompt: "select_account",
    access_type: "online",
  });
  return `${AUTORISATION}?${params.toString()}`;
}

export interface IdentiteGoogle {
  email: string;
  emailVerifie: boolean;
  nom?: string;
  sub: string;
}

/**
 * Échange le code contre l'identité.
 *
 * La signature du jeton n'est pas revérifiée, et c'est conforme : le jeton
 * arrive par une requête serveur à serveur vers `oauth2.googleapis.com`, en
 * TLS, et non par le navigateur. OpenID Connect l'autorise explicitement
 * (§3.1.3.7). Ce qui est vérifié, en revanche : le destinataire, l'émetteur,
 * l'échéance, le `nonce`, et le fait que l'adresse soit confirmée.
 */
export async function echangerCode(options: {
  code: string;
  redirection: string;
  nonce: string;
  configuration: ConfigurationGoogle;
}): Promise<IdentiteGoogle> {
  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.configuration.clientId,
      client_secret: options.configuration.clientSecret,
      redirect_uri: options.redirection,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!reponse.ok) {
    throw new Error(`Échange refusé par Google (${reponse.status})`);
  }

  const { id_token: idToken } = (await reponse.json()) as { id_token?: string };
  if (!idToken) throw new Error("Réponse Google sans id_token");

  const charge = lireCharge(idToken);

  if (charge.aud !== options.configuration.clientId) throw new Error("id_token destiné à une autre application");
  if (!EMETTEURS.includes(String(charge.iss))) throw new Error("id_token d'un émetteur inattendu");
  if (typeof charge.exp !== "number" || charge.exp * 1000 < Date.now()) throw new Error("id_token expiré");
  if (charge.nonce !== options.nonce) throw new Error("nonce discordant");

  const email = typeof charge.email === "string" ? charge.email.trim().toLowerCase() : "";
  if (!email) throw new Error("id_token sans adresse");

  return {
    email,
    // Google renvoie parfois la chaîne "true" plutôt que le booléen.
    emailVerifie: charge.email_verified === true || charge.email_verified === "true",
    nom: typeof charge.name === "string" ? charge.name : undefined,
    sub: String(charge.sub ?? ""),
  };
}

/** La charge utile d'un JWT, sans vérification de signature — voir `echangerCode`. */
function lireCharge(jeton: string): Record<string, unknown> {
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) throw new Error("id_token mal formé");
  const base64 = morceaux[1].replace(/-/g, "+").replace(/_/g, "/");
  const comble = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(comble, "base64").toString("utf-8")) as Record<string, unknown>;
}
