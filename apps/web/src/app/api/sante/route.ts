import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Route de santé du frontend Next.js.
 * Répond immédiatement sans dépendance externe ni rendu React.
 * Exemptée de détection de langue par le middleware.
 */
export async function GET() {
  return NextResponse.json({
    etat: "ok",
    service: "web",
    horodatage: new Date().toISOString(),
  });
}
