import { Anneau, Bandeau, BadgeStatut, Bouton, Carte, Icone, type PartAnneau } from "@teranga/ui";
import { prestataireConnecte } from "@/features/prestataire/session";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { dureeRestante, formaterPlage } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { demandesRecues, statistiquesPrestataire, type PeriodeStat } from "@/mocks/api";

/**
 * Tableau de bord du prestataire — maquette du collage prestataire, écran 5.
 *
 * Quatre indicateurs, les demandes récentes, et la répartition en anneau. Il
 * répond à « qu'est-ce qui attend quelque chose de moi, et comment ça va ? ».
 */
const PERIODES: PeriodeStat[] = ["semaine", "mois", "annee"];

const CLE_PERIODE: Record<PeriodeStat, string> = {
  semaine: "prestataire.cetteSemaine",
  mois: "prestataire.ceMois",
  annee: "prestataire.cetteAnnee",
};

export default async function TableauDeBord({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const { periode } = await searchParams;
  const t = traducteurPour(langue);

  const choisie = (PERIODES.includes(periode as PeriodeStat) ? periode : "semaine") as PeriodeStat;
  const compte = await prestataireConnecte();
  const [{ indicateurs, repartition }, demandes] = await Promise.all([
    statistiquesPrestataire(choisie),
    demandesRecues(),
  ]);

  const parts: PartAnneau[] = [
    { cle: "attente", libelle: t("prestataire.statutAttente"), valeur: repartition.attente, couleur: "var(--color-graphe-attente)", icone: "horloge" },
    { cle: "confirme", libelle: t("prestataire.statutConfirme"), valeur: repartition.confirme, couleur: "var(--color-graphe-confirme)", icone: "coche-cercle" },
    { cle: "refuse", libelle: t("prestataire.statutRefuse"), valeur: repartition.refuse, couleur: "var(--color-graphe-refuse)", icone: "croix" },
    { cle: "discussion", libelle: t("prestataire.statutDiscussion"), valeur: repartition.discussion, couleur: "var(--color-graphe-discussion)", icone: "whatsapp" },
  ];

  const aRepondre = demandes.filter((d) => d.statut === "envoyee");

  return (
    <>

      <main>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-titre-1 text-encre">
            {t("prestataire.bienvenueNom", { nom: compte?.nom ?? "" })}
          </h1>

          {/* Des liens plutôt qu'un menu : la période vit dans l'URL, donc une
              vue se partage et se recharge telle quelle. */}
          <nav aria-label={t("prestataire.periode")} className="flex gap-2">
            {PERIODES.map((p) => (
              <Lien
                key={p}
                href={p === "semaine" ? "/prestataire" : `/prestataire?periode=${p}`}
                aria-current={p === choisie ? "true" : undefined}
                className={
                  "inline-flex min-h-[var(--size-touch)] items-center rounded-control border px-3 text-petit font-semibold " +
                  (p === choisie
                    ? "border-primaire bg-primaire text-white"
                    : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                }
              >
                {t(CLE_PERIODE[p])}
              </Lien>
            ))}
          </nav>
        </div>

        {aRepondre.length > 0 && (
          <div className="mt-5">
            <Bandeau
              variante="avertissement"
              action={
                <Lien href="/prestataire/demandes" className="shrink-0 text-petit font-semibold underline">
                  {t("prestataire.mesDemandes")}
                </Lien>
              }
            >
              {t("prestataire.aRepondre", { nombre: aRepondre.length })}
            </Bandeau>
          </div>
        )}

        {/* indicateurs */}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {indicateurs.map((indicateur) => (
            <li key={indicateur.cle}>
              <Carte className="h-full p-5">
                <p className="text-[30px] font-semibold leading-none text-encre chiffres-tabulaires">
                  {indicateur.format === "montant"
                    ? formaterPrix(indicateur.valeur, langue)
                    : indicateur.format === "note"
                      ? indicateur.valeur.toFixed(1).replace(".", langue === "en" ? "." : ",")
                      : indicateur.valeur}
                </p>
                <p className="mt-2 text-petit text-encre-douce">
                  {t(`prestataire.${indicateur.cle}`)}
                </p>
                <Variation valeur={indicateur.variation} format={indicateur.format} langue={langue} />
              </Carte>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-legende text-encre-douce">{t("prestataire.revenusTexte")}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          {/* demandes récentes */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-titre-2 text-encre">{t("prestataire.demandesRecentes")}</h2>
              <Lien
                href="/prestataire/demandes"
                className="text-petit font-semibold text-primaire underline underline-offset-4"
              >
                {t("prestataire.voirToutes")}
              </Lien>
            </div>

            <ul className="space-y-3">
              {demandes.slice(0, 4).map((demande) => (
                <li key={demande.id}>
                  <Carte className="transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.18)]">
                    <Lien href={`/prestataire/demandes/${demande.id}`} className="flex items-start gap-3 p-4">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-titre-3 text-encre">{demande.offreTitre}</span>
                          <BadgeStatut
                            statut={demande.statut}
                            libelle={t(`statut.${demande.statut}`)}
                          />
                        </span>
                        <span className="mt-1 block text-petit text-encre-douce chiffres-tabulaires">
                          {formaterPlage(
                            new Date(demande.dates.debut),
                            new Date(demande.dates.fin),
                            langue,
                          )}
                          {" · "}
                          {formaterPrix(demande.total, langue)}
                        </span>
                        <span className="mt-1 block text-legende text-encre-douce">
                          {t("prestataire.ilYA", {
                            duree: dureeRestante(new Date(demande.recueLe), langue),
                          })}
                        </span>
                      </span>
                      <Icone nom="chevron-droite" taille={20} className="shrink-0 text-encre-douce" />
                    </Lien>
                  </Carte>
                </li>
              ))}
            </ul>
          </section>

          {/* répartition */}
          <section>
            <h2 className="mb-4 text-titre-2 text-encre">{t("prestataire.repartition")}</h2>
            <Carte className="p-5">
              <Anneau
                parts={parts}
                total={repartition.total}
                libelleTotal={t("prestataire.repartitionTotal")}
                etiquette={t("prestataire.repartitionEtiquette")}
              />
            </Carte>

            <Carte className="mt-5 p-5">
              <p className="flex items-center gap-2 text-titre-3 text-encre">
                <Icone nom="assistance" taille={20} className="text-encre-douce" />
                {t("prestataire.centreAide")}
              </p>
              <p className="mt-1 text-petit text-encre-douce">{t("prestataire.centreAideTexte")}</p>
              <div className="mt-4">
                <Lien href="/prestataire/aide">
                  <Bouton variante="secondaire" largeur="pleine">
                    {t("prestataire.voirAide")}
                  </Bouton>
                </Lien>
              </div>
            </Carte>
          </section>
        </div>
      </main>
    </>
  );
}

/**
 * La variation porte une flèche **et** un signe, jamais la couleur seule :
 * c'est la règle des statuts appliquée à un chiffre.
 */
function Variation({
  valeur,
  format,
  langue,
}: {
  valeur: number;
  format: "nombre" | "note" | "montant";
  langue: Langue;
}) {
  const t = traducteurPour(langue);
  const hausse = valeur >= 0;
  const affichage =
    format === "note"
      ? `${hausse ? "+" : ""}${valeur.toFixed(1).replace(".", langue === "en" ? "." : ",")}`
      : `${hausse ? "+" : ""}${valeur} %`;

  return (
    <p
      className={
        "mt-2 inline-flex items-center gap-1 text-petit font-semibold " +
        (hausse ? "text-succes" : "text-danger")
      }
    >
      <Icone nom={hausse ? "chevron-droite" : "chevron-gauche"} taille={16} />
      {affichage}
      <span className="sr-only">
        {t(hausse ? "prestataire.variationHausse" : "prestataire.variationBaisse", {
          valeur: affichage,
        })}
      </span>
    </p>
  );
}
