import { notFound, redirect } from "next/navigation";
import { BadgeStatut, Carte, Icone } from "@teranga/ui";
import type { DemandeAdmin } from "@teranga/contracts";
import { ErreurApi } from "@/lib/api/http";
import { formaterDateHeure, formaterJour } from "@/features/admin/format";
import { ServeurInjoignable } from "@/features/admin/serveur-injoignable";
import { jetonAdmin, urlConnexionAdmin } from "@/features/admin/session";
import { TraitementDemande } from "@/features/admin/traitement-demande";
import { apiAdminDemande, apiAdminPrestataires } from "@/lib/api/administration";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { formaterPrix } from "@/lib/prix";

/**
 * Rendu à la demande, toujours.
 *
 * Sans cette ligne, Next prérend la page au build : le cookie d'équipe est
 * alors absent, la redirection vers la connexion part dans le HTML statique,
 * et le backoffice reste fermé même pour qui a une session valide.
 */
export const dynamic = "force-dynamic";

/**
 * Une demande, entière.
 *
 * Rien n'est masqué ici : coordonnées du visiteur, détails du formulaire,
 * message, historique, prestataire. C'est le poste de travail de l'équipe —
 * si une information manque, elle rappelle le visiteur pour la redemander, et
 * c'est précisément ce que ce backoffice doit éviter.
 */
export default async function FicheDemandeAdmin({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  const jeton = await jetonAdmin();
  if (!jeton) redirect(urlConnexionAdmin(langue));

  let demande: DemandeAdmin;
  let prestataires: Awaited<ReturnType<typeof apiAdminPrestataires>> = [];
  try {
    [demande, prestataires] = await Promise.all([
      apiAdminDemande(jeton, id),
      apiAdminPrestataires(jeton),
    ]);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) notFound();
    if (erreur instanceof ErreurApi && (erreur.statut === 401 || erreur.statut === 403)) {
      redirect(urlConnexionAdmin(langue));
    }
    // Tout le reste — API éteinte, 500, réseau coupé — se dit à l'écran :
    // une trace de pile ne répare rien et affole.
    return <ServeurInjoignable langue={langue} />;
  }

  return (
    <>
      <Lien
        href="/admin/demandes"
        className="inline-flex items-center gap-2 text-petit font-semibold text-encre-douce hover:text-primaire"
      >
        <Icone nom="chevron-gauche" taille={16} />
        {t("admin.retour")}
      </Lien>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-titre-1 text-encre chiffres-tabulaires">{demande.reference}</h1>
        <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
        <span className="rounded-pill bg-champ px-2.5 py-1 text-legende font-semibold text-encre-douce">
          {t(`admin.genre.${demande.genre}`)}
        </span>
      </div>

      <p className="mt-1 text-petit text-encre-douce">
        {t("admin.recueLe")} {formaterDateHeure(demande.creeLe, langue)}
        {" · "}
        {t("admin.misAJourLe")} {formaterDateHeure(demande.misAJourLe, langue)}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Bloc titre={demande.offre.titre}>
            <Lignes
              lignes={[
                [t("admin.sejour"), periode(demande, langue)],
                [t("admin.personnes"), String(demande.personnes)],
                [t("admin.heureArrivee"), demande.heureArrivee],
                [
                  t("admin.prixTotal"),
                  demande.prix.total > 0 ? formaterPrix(demande.prix.total, langue) : t("admin.surDevis"),
                ],
              ]}
            />
          </Bloc>

          {demande.transport && (
            <Bloc titre={t("admin.trajetBloc")}>
              <Lignes
                lignes={[
                  [t("admin.depart"), demande.transport.depart],
                  [t("admin.arrivee"), demande.transport.arrivee],
                  [
                    t("admin.bagages"),
                    demande.transport.bagages !== undefined
                      ? String(demande.transport.bagages)
                      : undefined,
                  ],
                  [t("admin.vol"), demande.transport.vol],
                ]}
              />
            </Bloc>
          )}

          {demande.service && (
            <Bloc titre={t("admin.detailsService")}>
              <p className="text-petit font-semibold text-encre">
                {t(`services.${demande.service.cle}Titre`)}
              </p>
              <div className="mt-3">
                <Lignes
                  lignes={Object.entries(demande.service.details).map(([cle, valeur]) => [
                    libelleChamp(t, cle),
                    libelleValeur(t, valeur),
                  ])}
                />
              </div>
            </Bloc>
          )}

          {demande.message && (
            <Bloc titre={t("admin.messageVisiteur")}>
              <p className="whitespace-pre-line text-petit text-encre">{demande.message}</p>
            </Bloc>
          )}

          <Bloc titre={t("admin.historique")}>
            <ol className="space-y-2">
              {demande.frise.map((etape, rang) => (
                <li
                  key={`${etape.statut}-${rang}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-petit"
                >
                  <span className="text-encre">{t(`statut.${etape.statut}`)}</span>
                  <span className="text-encre-douce chiffres-tabulaires">
                    {formaterDateHeure(etape.horodatage, langue)} ·{" "}
                    {t(`admin.origine.${etape.origine}`)}
                  </span>
                </li>
              ))}
            </ol>
          </Bloc>
        </div>

        <div className="space-y-5">
          <Bloc titre={t("admin.visiteur")}>
            <Lignes
              lignes={[
                ["", demande.visiteur.nom],
                ["", demande.visiteur.email],
                ["", demande.visiteur.telephone],
              ]}
            />
            <p className="mt-2 text-legende text-encre-douce chiffres-tabulaires">
              {demande.visiteur.id}
            </p>
          </Bloc>

          <Bloc titre={t("admin.prestataire")}>
            {demande.prestataire ? (
              <Lignes
                lignes={[
                  ["", demande.prestataire.nom],
                  ["", demande.prestataire.email],
                  ["", demande.prestataire.telephone],
                ]}
              />
            ) : (
              <p className="text-petit text-encre-douce">{t("admin.aucunPrestataire")}</p>
            )}
          </Bloc>

          <TraitementDemande demande={demande} prestataires={prestataires} />
        </div>
      </div>
    </>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Carte className="p-5">
      <h2 className="text-titre-3 text-encre">{titre}</h2>
      <div className="mt-3">{children}</div>
    </Carte>
  );
}

/** Un tableau de définitions : les valeurs vides ne s'affichent pas du tout. */
function Lignes({ lignes }: { lignes: [string, string | undefined][] }) {
  const retenues = lignes.filter(([, valeur]) => valeur);
  if (retenues.length === 0) return <p className="text-petit text-encre-douce">—</p>;

  return (
    <dl className="space-y-2">
      {retenues.map(([libelle, valeur], rang) => (
        <div key={`${libelle}-${rang}`} className="flex flex-wrap items-baseline justify-between gap-3">
          {libelle && <dt className="text-petit text-encre-douce">{libelle}</dt>}
          <dd className={`text-petit text-encre ${libelle ? "font-semibold" : ""}`}>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

function periode(demande: DemandeAdmin, langue: Langue): string | undefined {
  const { debut, fin } = demande.dates;
  if (!debut && !fin) return undefined;
  if (!fin || fin === debut) return formaterJour(debut, langue);
  return `${formaterJour(debut, langue)} → ${formaterJour(fin, langue)}`;
}

/**
 * Le nom d'un champ de service, dans la langue de l'équipe.
 *
 * Les clés viennent du formulaire visiteur : on réutilise ses libellés plutôt
 * que d'en inventer une seconde liste, qui aurait dérivé dès le premier champ
 * ajouté. Une clé inconnue s'affiche telle quelle — mieux vaut `quartier` à
 * l'écran qu'une ligne manquante.
 */
function libelleChamp(t: Traducteur, cle: string): string {
  const traduit = t(`demandeService.champ.${cle}`);
  return traduit === `demandeService.champ.${cle}` ? cle : traduit;
}

function libelleValeur(t: Traducteur, valeur: string): string {
  const traduit = t(`demandeService.champ.${valeur}`);
  return traduit === `demandeService.champ.${valeur}` ? valeur : traduit;
}
