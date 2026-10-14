import { redirect } from "next/navigation";

/**
 * Les statistiques de la maquette sont celles du tableau de bord : mêmes quatre
 * indicateurs, même répartition. Une seconde page les ferait diverger.
 */
export default async function Statistiques({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/prestataire?periode=mois`);
}
