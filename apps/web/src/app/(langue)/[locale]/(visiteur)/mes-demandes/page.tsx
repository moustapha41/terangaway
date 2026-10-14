import { redirect } from "next/navigation";

/**
 * « Mes demandes » vit maintenant dans l'espace client (maquette du tableau de
 * bord). L'ancienne adresse reste valide : elle est dans la barre du bas, dans
 * l'écran de confirmation et dans les liens déjà partagés.
 */
export default async function MesDemandes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/compte/reservations`);
}
