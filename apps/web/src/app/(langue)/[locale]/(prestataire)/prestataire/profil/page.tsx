import { Bandeau, Carte, Icone } from "@teranga/ui";
import { prestataireConnecte } from "@/features/prestataire/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterDateComplete } from "@/lib/dates";

/**
 * Profil du partenaire — en lecture.
 *
 * Rien ne se modifie en ligne : un changement de numéro rouvre la vérification,
 * et le numéro est ce qui identifie le partenaire sur chaque demande. Le laisser
 * changer d'un clic reviendrait à laisser changer de compte.
 */
export default async function Profil({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);
  const compte = await prestataireConnecte();
  if (!compte) return null;

  return (
    <>

      <main className="max-w-[600px]">
        <h1 className="text-titre-1 text-encre">{t("prestataire.profilTitre")}</h1>

        <Carte className="mt-6 space-y-4 p-5">
          <Ligne icone="personnes" terme={t("prestataire.profilNom")}>{compte.nom}</Ligne>
          <Ligne icone="telephone" terme={t("prestataire.profilTelephone")}>
            <span className="chiffres-tabulaires">{compte.telephone}</span>
          </Ligne>

          {compte.verifieLe && (
            <p className="flex items-center gap-2 border-t border-contour pt-4 text-petit text-succes">
              <Icone nom="verification" taille={20} />
              {t("prestataire.profilVerifie", {
                date: formaterDateComplete(new Date(compte.verifieLe), langue),
              })}
            </p>
          )}
          {compte.charteSigneeLe && (
            <p className="flex items-center gap-2 text-petit text-encre-douce">
              <Icone nom="coche-cercle" taille={20} />
              {t("prestataire.profilCharte", {
                date: formaterDateComplete(new Date(compte.charteSigneeLe), langue),
              })}
            </p>
          )}
        </Carte>

        <div className="mt-5">
          <Bandeau variante="information">{t("prestataire.profilModifier")}</Bandeau>
        </div>

        <nav className="mt-8 space-y-2">
          <Raccourci href="/prestataire/documents" icone="verification">
            {t("prestataire.documentsTitre")}
          </Raccourci>
          <Raccourci href="/prestataire/aide" icone="assistance">
            {t("prestataire.aideTitre")}
          </Raccourci>
        </nav>
      </main>
    </>
  );
}

function Ligne({
  icone,
  terme,
  children,
}: {
  icone: "personnes" | "telephone";
  terme: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icone nom={icone} taille={20} className="mt-0.5 shrink-0 text-encre-douce" />
      <div>
        <p className="text-petit text-encre-douce">{terme}</p>
        <p className="text-corps text-encre">{children}</p>
      </div>
    </div>
  );
}

function Raccourci({
  href,
  icone,
  children,
}: {
  href: string;
  icone: "verification" | "assistance";
  children: React.ReactNode;
}) {
  return (
    <Lien
      href={href}
      className="flex min-h-[var(--size-control)] items-center gap-3 rounded-control border border-contour bg-surface px-4 text-corps text-encre hover:border-primaire/40"
    >
      <Icone nom={icone} taille={20} className="text-encre-douce" />
      <span className="flex-1">{children}</span>
      <Icone nom="chevron-droite" taille={20} className="text-encre-douce" />
    </Lien>
  );
}
