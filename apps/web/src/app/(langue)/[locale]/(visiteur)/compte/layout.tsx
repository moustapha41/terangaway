import { redirect } from "next/navigation";
import { EnTete } from "@/components/layout/en-tete";
import { BarreLaterale } from "@/components/client/barre-laterale";
import { visiteurConnecte } from "@/features/compte/session";
import { estLangue } from "@/lib/i18n/langues";

/**
 * Enveloppe de l'espace client — maquette du tableau de bord.
 *
 * La colonne de navigation est commune à toutes les pages de l'espace ; elle
 * passe au-dessus du contenu sous `lg`, où la barre du bas du produit reste la
 * navigation principale.
 */
export default async function LayoutCompte({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const langue = estLangue(locale) ? locale : "fr";

  const visiteur = await visiteurConnecte();
  if (!visiteur) redirect(`/${langue}/connexion?suite=%2Fcompte`);

  const nom = nomLisible(visiteur.identifiant);

  return (
    <main className="bg-page pb-16">
      <EnTete visiteur={nom} />

      <div className="mx-auto grid w-[92%] max-w-[1260px] gap-8 pt-6 lg:grid-cols-[250px_1fr] lg:items-start">
        <BarreLaterale nom={nom} />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}

/**
 * Un nom présentable tiré de l'identifiant.
 *
 * Tant qu'il n'y a pas de profil, l'e-mail est tout ce qu'on a. On en tire des
 * mots capitalisés plutôt que d'afficher « rokhaya.seck@exemple.sn » en haut de
 * l'espace — et le jour où le profil existe, seule cette fonction disparaît.
 */
function nomLisible(identifiant: string): string {
  const base = identifiant.includes("@") ? identifiant.split("@")[0] : identifiant;
  return base
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}
