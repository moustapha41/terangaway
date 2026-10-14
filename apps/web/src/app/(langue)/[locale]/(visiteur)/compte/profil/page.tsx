import { Bandeau, Carte, Icone, type NomIcone } from "@teranga/ui";
import { Avatar } from "@/components/client/barre-laterale";
import { visiteurConnecte } from "@/features/compte/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Mon profil — maquette de l'espace client, écran mobile 7.
 *
 * Court, et c'est volontaire : la plateforme ne garde qu'un identifiant de
 * contact. Les entrées qui mènent ailleurs y mènent vraiment ; celles qui
 * n'existent pas encore ne sont pas affichées.
 */
const ENTREES: { cle: string; href: string; icone: NomIcone }[] = [
  { cle: "preferences", href: "/compte/parametres", icone: "filtre" },
  { cle: "notifications", href: "/compte/parametres", icone: "alerte" },
  { cle: "mesFavoris", href: "/compte/favoris", icone: "verification" },
  { cle: "confidentialite", href: "/legal#donnees", icone: "information" },
];

export default async function Profil({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const visiteur = await visiteurConnecte();
  if (!visiteur) return null;

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-5 text-titre-1 text-encre">{t("client.profilTitre")}</h1>

      <Carte className="p-5">
        <div className="flex items-center gap-4">
          <Avatar nom={visiteur.identifiant} taille={56} />
          <div className="min-w-0">
            <p className="truncate text-titre-3 text-encre">{visiteur.identifiant}</p>
            <p className="mt-0.5 text-petit text-encre-douce">{t("client.profilRole")}</p>
          </div>
        </div>

        <dl className="mt-5 border-t border-contour pt-4">
          <dt className="text-petit text-encre-douce">{t("client.profilIdentifiant")}</dt>
          <dd className="mt-1 text-corps text-encre">{visiteur.identifiant}</dd>
          <dd className="mt-1 text-legende text-encre-douce">
            {t("client.profilIdentifiantTexte")}
          </dd>
        </dl>
      </Carte>

      <div className="mt-5">
        <Bandeau variante="information">{t("client.profilModifierTexte")}</Bandeau>
      </div>

      <nav className="mt-6 overflow-hidden rounded-card border border-contour bg-surface">
        {ENTREES.map((entree) => (
          <Lien
            key={entree.cle}
            href={entree.href}
            className="flex min-h-[var(--size-control)] items-center gap-3 border-b border-contour px-5 text-petit text-encre transition-colors last:border-0 hover:bg-champ"
          >
            <Icone nom={entree.icone} taille={20} className="text-encre-douce" />
            <span className="flex-1">{t(`client.${entree.cle}`)}</span>
            <Icone nom="chevron-droite" taille={20} className="text-encre-douce" />
          </Lien>
        ))}
      </nav>
    </div>
  );
}
