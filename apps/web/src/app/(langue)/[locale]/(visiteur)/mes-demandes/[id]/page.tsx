import { notFound, redirect } from "next/navigation";
import type { CoordonneesLogement, Demande, StatutDemande } from "@teranga/contracts";
import { STATUTS_TERMINAUX } from "@teranga/contracts";
import { BadgeStatut, Bandeau, Bouton, Carte, FriseStatut, Icone, type EtapeFrise } from "@teranga/ui";
import { EnTete } from "@/components/layout/en-tete";
import { annuler, confirmer } from "@/features/demande/actions";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { formaterPrix } from "@/lib/prix";
import { obtenirDemande } from "@/mocks/api";
import { visiteurConnecte } from "@/features/compte/session";

/**
 * Écran 6 · Détail d'une demande (§C.7).
 *
 * Badge de statut et phrase d'explication · frise · récapitulatif et prix ·
 * après confirmation seulement : adresse, contact, consignes · boutons selon
 * le statut.
 *
 * C'est aussi l'écran de l'étape 7 : le jour venu, le visiteur y retrouve tout,
 * avec le rappel que le paiement se fait sur place.
 */
const ORDRE: StatutDemande[] = ["envoyee", "acceptee", "confirmee", "terminee"];

export default async function DetailDemande({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = traducteurPour(langue);

  // Route privée : la session se vérifie ici, côté serveur, et pas seulement
  // dans le middleware. Le middleware ne juge que la *forme* du cookie ; seul
  // cet appel confronte le jeton aux sessions vivantes de l'API.
  //
  // Sans lui, un cookie de forme plausible arrivait jusqu'à l'appel API, qui
  // répondait 401, et le visiteur tombait sur l'écran de panne au lieu d'être
  // renvoyé vers la connexion.
  const visiteur = await visiteurConnecte();
  if (!visiteur) {
    redirect(`/${langue}/connexion?suite=${encodeURIComponent(`/mes-demandes/${id}`)}`);
  }

  const demande = await obtenirDemande(id);
  if (!demande) notFound();

  return (
    <main className="bg-page pb-16">
      <EnTete />

      <div className="mx-auto w-[87.5%] max-w-[760px] pt-6">
        <Lien href="/mes-demandes" className="inline-flex items-center gap-2 text-petit font-semibold text-primaire">
          <Icone nom="retour" taille={16} />
          {t("mesDemandes.titre")}
        </Lien>

        <header className="mt-4">
          <BadgeStatut statut={demande.statut} libelle={t(`statut.${demande.statut}`)} />
          <h1 className="mt-3 text-titre-1 text-encre">{demande.offre.titre}</h1>
          <p className="mt-1 text-petit text-encre-douce chiffres-tabulaires">
            {t("detailDemande.titre", { reference: demande.reference })}
          </p>
          <p className="mt-3 text-corps text-encre-douce">
            {t(`detailDemande.explication.${demande.statut}`)}
          </p>
          {demande.statut === "refusee" && demande.motifRefus && (
            <p className="mt-2 text-corps text-encre">
              {t(`detailDemande.motifRefus.${demande.motifRefus}`)}
            </p>
          )}
        </header>

        <section className="mt-8">
          <h2 className="mb-4 text-titre-2 text-encre">{t("detailDemande.frise")}</h2>
          <FriseStatut etapes={construireFrise(demande, langue)} />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-titre-2 text-encre">{t("detailDemande.recapitulatif")}</h2>
          <Recapitulatif demande={demande} langue={langue} t={t} />
        </section>

        {/* Après confirmation seulement. Ailleurs, ces champs n'existent même pas. */}
        {demande.coordonnees ? (
          <Coordonnees coordonnees={demande.coordonnees as CoordonneesLogement} t={t} />
        ) : (
          <div className="mt-6">
            <Bandeau variante="information">{t("fiche.adresseMasquee")}</Bandeau>
          </div>
        )}

        <Actions demande={demande} t={t} />
      </div>
    </main>
  );
}

/**
 * La frise montre les quatre étapes du cycle nominal, plus l'issue si elle n'est
 * pas nominale. Une demande refusée n'affiche pas « Confirmée » en gris : ce
 * serait promettre une suite qui n'arrivera pas.
 */
function construireFrise(demande: Demande, langue: Langue): EtapeFrise[] {
  const t = traducteurPour(langue);
  const franchies = new Map(demande.frise.map((e) => [e.statut, e.horodatage]));
  const terminal = STATUTS_TERMINAUX.includes(demande.statut) && demande.statut !== "terminee";

  const nominales = terminal
    ? ORDRE.slice(0, ORDRE.indexOf(demande.frise.at(-2)?.statut ?? "envoyee") + 1)
    : ORDRE;

  const etapes: EtapeFrise[] = nominales.map((statut) => ({
    statut,
    libelle: t(`statut.${statut}`),
    horodatage: franchies.has(statut)
      ? formaterQuand(new Date(franchies.get(statut)!), langue)
      : undefined,
    etat: franchies.has(statut)
      ? statut === demande.statut
        ? "en-cours"
        : "faite"
      : "a-venir",
  }));

  if (terminal) {
    etapes.push({
      statut: demande.statut,
      libelle: t(`statut.${demande.statut}`),
      horodatage: franchies.has(demande.statut)
        ? formaterQuand(new Date(franchies.get(demande.statut)!), langue)
        : undefined,
      etat: "en-cours",
    });
  }

  return etapes;
}

function formaterQuand(date: Date, langue: Langue): string {
  return `${formaterDateComplete(date, langue)} · ${formaterHeure(date, langue)}`;
}

function Recapitulatif({
  demande,
  langue,
  t,
}: {
  demande: Demande;
  langue: Langue;
  t: Traducteur;
}) {
  const prix = demande.prix;
  const detaille = "nuits" in prix;

  return (
    <Carte className="p-5">
      <dl className="space-y-2">
        <Ligne terme={t("demande.dates")}>
          {formaterDateComplete(new Date(demande.dates.debut), langue)} –{" "}
          {formaterDateComplete(new Date(demande.dates.fin), langue)}
        </Ligne>
        <Ligne terme={t("demande.personnes")}>
          {t("fiche.capacite", { nombre: demande.personnes })}
        </Ligne>
        {demande.heureArrivee && (
          <Ligne terme={t("demande.heureArrivee")}>{demande.heureArrivee}</Ligne>
        )}
        {detaille && (
          <Ligne
            terme={t("fiche.detailNuits", {
              prix: formaterPrix(prix.prixParNuit, langue),
              nuits: t("fiche.nuits", { nombre: prix.nuits }),
            })}
          >
            {formaterPrix(prix.prixParNuit * prix.nuits, langue)}
          </Ligne>
        )}
        {detaille &&
          prix.fraisFixes.map((frais) => (
            <Ligne key={frais.libelle} terme={frais.libelle}>
              {formaterPrix(frais.montant, langue)}
            </Ligne>
          ))}
      </dl>

      <p className="mt-4 flex items-baseline justify-between border-t border-contour pt-4 text-prix text-encre chiffres-tabulaires">
        <span className="text-corps font-normal text-encre-douce">{t("fiche.total")}</span>
        {formaterPrix(prix.total, langue)}
      </p>
      <p className="mt-2 text-legende text-encre-douce">{t("resultats.paiementSurPlace")}</p>
    </Carte>
  );
}

function Coordonnees({ coordonnees, t }: { coordonnees: CoordonneesLogement; t: Traducteur }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-titre-2 text-encre">{t("detailDemande.coordonnees")}</h2>
      <Carte className="space-y-4 p-5">
        <Detail icone="repere" terme={t("detailDemande.adresse")}>
          {coordonnees.adresseExacte}
        </Detail>
        <Detail icone="telephone" terme={t("detailDemande.telephone")}>
          <a href={`tel:${coordonnees.telephone.replace(/\s/g, "")}`} className="underline underline-offset-2">
            {coordonnees.telephone}
          </a>
        </Detail>
        {coordonnees.consignesArrivee && (
          <Detail icone="information" terme={t("detailDemande.consignes")}>
            {coordonnees.consignesArrivee}
          </Detail>
        )}
      </Carte>
    </section>
  );
}

/** Les boutons dépendent du statut : un statut terminal ne propose plus d'action. */
function Actions({ demande, t }: { demande: Demande; t: Traducteur }) {
  if (demande.statut === "acceptee") {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form action={confirmer} className="flex-1">
          <input type="hidden" name="id" value={demande.id} />
          <Bouton type="submit" variante="confirmation" largeur="pleine">
            {t("detailDemande.confirmer")}
          </Bouton>
        </form>
        <form action={annuler} className="flex-1">
          <input type="hidden" name="id" value={demande.id} />
          <Bouton type="submit" variante="danger" largeur="pleine">
            {t("detailDemande.annuler")}
          </Bouton>
        </form>
      </div>
    );
  }

  if (demande.statut === "envoyee" || demande.statut === "confirmee") {
    return (
      <div className="mt-8">
        <form action={annuler}>
          <input type="hidden" name="id" value={demande.id} />
          <Bouton type="submit" variante="danger" largeur="contenu">
            {t("detailDemande.annuler")}
          </Bouton>
        </form>
      </div>
    );
  }

  if (demande.statut === "refusee" || demande.statut === "expiree") {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Lien href={`/demande/${demande.offre.genre === "logement" ? demande.offre.logementId : ""}`}>
          <Bouton variante="principal" largeur="pleine">
            {t("detailDemande.refaire")}
          </Bouton>
        </Lien>
        <Lien href="/logements">
          <Bouton variante="secondaire" largeur="pleine">
            {t("detailDemande.voirAutres")}
          </Bouton>
        </Lien>
      </div>
    );
  }

  return null;
}

function Ligne({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-petit text-encre-douce">{terme}</dt>
      <dd className="text-petit text-encre chiffres-tabulaires">{children}</dd>
    </div>
  );
}

function Detail({
  icone,
  terme,
  children,
}: {
  icone: "repere" | "telephone" | "information";
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
