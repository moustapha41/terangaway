/**
 * Client HTTP minimal vers l'API Nest.
 *
 * Utilisé dès qu'un domaine d'écriture bascule hors mock
 * (`NEXT_PUBLIC_API_MOCK=false`).
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

export function apiMockActive(): boolean {
  return process.env.NEXT_PUBLIC_API_MOCK !== "false";
}

function baseUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  );
}

export async function appelerApi<T>(
  chemin: string,
  options: {
    method?: "GET" | "POST";
    corps?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const reponse = await fetch(`${baseUrl()}${chemin}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    cache: "no-store",
  });

  const json = (await reponse.json().catch(() => ({}))) as {
    donnees?: T;
    erreur?: { code: string; message: string };
  };

  if (!reponse.ok) {
    throw new ErreurApi(
      json.erreur?.code ?? "ERREUR_SERVEUR",
      json.erreur?.message ?? "Une erreur est survenue.",
      reponse.status,
    );
  }

  return json.donnees as T;
}
