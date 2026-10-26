/**
 * Client HTTP minimal vers l'API Nest.
 *
 * Utilisé pour tout domaine d'écriture, sauf si les fixtures sont réclamées
 * par `NEXT_PUBLIC_API_MOCK=true` (voir `apiMockActive`).
 */

export class ErreurApi extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statut: number,
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

/**
 * Les données simulées répondent-elles à la place de l'API ?
 *
 * **Refus par défaut** : il faut réclamer les fixtures par
 * `NEXT_PUBLIC_API_MOCK=true`, et rien d'autre ne les ouvre. La lecture
 * précédente — « actif sauf si la valeur vaut exactement `false` » — faisait
 * de l'absence de variable un mode mock, et une variable absente est le cas
 * le plus courant : aucun `apps/web/.env` sur un poste de développement, une
 * image construite sans l'argument de construction. Le parcours paraissait
 * alors normal de bout en bout — la demande partait, la confirmation
 * s'affichait avec une référence — mais rien n'était écrit en base et « Mes
 * réservations » montrait le catalogue de démonstration. Une variable absente
 * doit fermer la porte, pas l'ouvrir : c'est la même règle que
 * `config.autoriserComptesDemo` côté API.
 *
 * `NEXT_PUBLIC_*` est figé à la construction : la valeur est donc la même
 * côté serveur et côté navigateur, sans aller-retour.
 */
export function apiMockActive(): boolean {
  return process.env.NEXT_PUBLIC_API_MOCK === "true";
}

function baseUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  );
}

/** Ce qui est réellement parti, et ce qui est annoncé, après une demande. */
export interface NotificationApi {
  emailEnvoye: boolean;
  acompteAnnonce?: boolean;
  /**
   * Le jeton qui autorise la seule réponse à « voulez-vous qu'on vienne vous
   * chercher à l'aéroport ? », pour cette demande. Il reste côté serveur : le
   * cookie de confirmation le garde, et le navigateur ne le lit jamais.
   */
  jetonSuite?: string;
}

type OptionsAppel = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  corps?: unknown;
  headers?: Record<string, string>;
};

export async function appelerApi<T>(chemin: string, options: OptionsAppel = {}): Promise<T> {
  return (await appelerApiEnveloppe<T>(chemin, options)).donnees;
}

/**
 * Comme `appelerApi`, mais rend aussi `notification` : ce qui est réellement
 * parti (l'e-mail) après l'enregistrement d'une demande.
 */
export async function appelerApiEnveloppe<T>(
  chemin: string,
  options: OptionsAppel = {},
): Promise<{ donnees: T; notification?: NotificationApi }> {
  const forwardedHeaders: Record<string, string> = {};
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const xForwardedFor = h.get("x-forwarded-for");
    const xRealIp = h.get("x-real-ip");
    if (xForwardedFor) forwardedHeaders["x-forwarded-for"] = xForwardedFor;
    if (xRealIp) forwardedHeaders["x-real-ip"] = xRealIp;
  } catch {
    // Exécution hors contexte de requête Next.js (ex: compilation statique ou tests)
  }

  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const token = jar.get("teranga_visiteur")?.value;
    if (
      token &&
      !options.headers?.["authorization"] &&
      !options.headers?.["Authorization"] &&
      !options.headers?.["x-visiteur-id"]
    ) {
      forwardedHeaders["authorization"] = `Bearer ${token}`;
    }
  } catch {
    // Exécution hors contexte de cookies Next.js
  }

  const reponse = await fetch(`${baseUrl()}${chemin}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...forwardedHeaders,
      ...options.headers,
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    cache: "no-store",
  });

  const json = (await reponse.json().catch(() => ({}))) as {
    donnees?: T;
    notification?: NotificationApi;
    erreur?: { code: string; message: string };
  };

  if (!reponse.ok) {
    throw new ErreurApi(
      json.erreur?.code ?? "ERREUR_SERVEUR",
      json.erreur?.message ?? "Une erreur est survenue.",
      reponse.status,
    );
  }

  return { donnees: json.donnees as T, notification: json.notification };
}
