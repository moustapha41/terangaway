import { redirect } from "next/navigation";

/**
 * « Mes demandes » de la maquette est la même liste que « Mes réservations »,
 * limitée à celles qui attendent encore une réponse. Deux listes distinctes
 * finiraient par diverger ; on redirige vers la vue filtrée.
 */
export default async function Demandes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/compte/reservations?filtre=enAttente`);
}
