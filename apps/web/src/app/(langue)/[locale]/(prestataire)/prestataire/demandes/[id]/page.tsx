import { notFound } from "next/navigation";
import { BadgeStatut, Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { repondre } from "@/features/prestataire/actions";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { dureeRestante, formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { demandeRecue } from "@/mocks/api";

/**
 * Répondre à une demande depuis l'espace.
 *
 * Mêmes règles que la page par jeton : rien du visiteur avant la confirmation,
 * et la réponse passe par un `<form>` pour ne dépendre d'aucun JavaScript.
 */
export default async function DetailDemandeRecue({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const demande = await demandeRecue(id);
  if (!demande) notFound();

  const aRepondre = demande.statut === "envoyee";

  return (
    <>

      <main className="max-w-[640px]">
        <Lien
          href="/prestataire/demandes"
          className="inline-flex items-center gap-2 text-petit font-semibold text-primaire"
        >
          <Icone nom="retour" taille={16} />
          {t("prestataire.mesDemandes")}
        </Lien>

        <div className="mt-4">
          <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
        </div>
        <h1 className="mt-3 text-titre-1 text-encre">{demande.offreTitre}</h1>
        <p className="mt-1 text-petit text-encre-douce chiffres-tabulaires">
          {t("prestataire.demandeTitre", { reference: demande.reference })}
        </p>

        {demande.expireLe && (
          <div className="mt-5">
            <Bandeau variante="avertissement">
              {t("prestataire.repondreAvant", {
                duree: dureeRestante(new Date(demande.expireLe), langue),
              })}
            </Bandeau>
          </div>
        )}

        <Carte className="mt-5 p-5">
          <dl className="space-y-2">
            <Ligne terme={t("demande.dates")}>
              {formaterPlage(new Date(demande.dates.debut), new Date(demande.dates.fin), langue)}
            </Ligne>
            <Ligne terme={t("demande.personnes")}>{demande.personnes}</Ligne>
          </dl>
          <p className="mt-4 flex items-baseline justify-between border-t border-contour pt-4 text-prix text-encre chiffres-tabulaires">
            <span className="text-corps font-normal text-encre-douce">{t("fiche.total")}</span>
            {formaterPrix(demande.total, langue)}
          </p>
          <p className="mt-3 text-legende text-encre-douce">{t("prestataire.coordonneesApres")}</p>
        </Carte>

        <div className="mt-5">
          <Bandeau variante="information">{t("prestataire.rappelAcompte")}</Bandeau>
        </div>

        {aRepondre && (
          <div className="mt-8 space-y-3">
            <form action={repondre}>
              <input type="hidden" name="id" value={demande.id} />
              <input type="hidden" name="reponse" value="acceptee" />
              <Bouton type="submit" variante="confirmation" largeur="pleine">
                {t("prestataire.accepter")}
              </Bouton>
            </form>
            <form action={repondre}>
              <input type="hidden" name="id" value={demande.id} />
              <input type="hidden" name="reponse" value="refusee" />
              <Bouton type="submit" variante="danger" largeur="pleine">
                {t("prestataire.refuser")}
              </Bouton>
            </form>
          </div>
        )}
      </main>
    </>
  );
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre chiffres-tabulaires">{children}</dd>
    </div>
  );
}
