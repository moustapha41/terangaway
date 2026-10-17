import { cookies } from "next/headers";
import { COOKIE_ADMIN } from "@/features/admin/cookie";

/**
 * L'export CSV, relayé depuis l'API.
 *
 * Le navigateur ne peut pas appeler l'API directement : le jeton d'équipe vit
 * dans un cookie `httpOnly`, et c'est bien ainsi. Cette route le lit côté
 * serveur, demande le fichier et le repasse tel quel — les colonnes sont
 * décidées par l'API, à un seul endroit, et l'écran n'en connaît aucune.
 */
export async function GET(requete: Request): Promise<Response> {
  const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
  if (!jeton) return new Response("Session requise.", { status: 401 });

  const requeteUrl = new URL(requete.url);
  const base =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const reponse = await fetch(
    `${base}/administration/demandes/export?${requeteUrl.searchParams.toString()}`,
    { headers: { authorization: `Bearer ${jeton}` }, cache: "no-store" },
  );

  if (!reponse.ok) {
    return new Response("Export indisponible.", { status: reponse.status });
  }

  const jour = new Date().toISOString().slice(0, 10);
  return new Response(await reponse.text(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="demandes-${jour}.csv"`,
      // Une extraction de demandes ne se met en cache nulle part.
      "Cache-Control": "no-store",
    },
  });
}
