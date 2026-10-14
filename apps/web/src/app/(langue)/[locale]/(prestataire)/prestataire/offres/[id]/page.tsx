import { redirect } from "next/navigation";

/** L'édition d'une offre commence par les photos : c'est ce qui manque le plus souvent. */
export default async function Offre({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  redirect(`/${locale}/prestataire/offres/${id}/photos`);
}
