import { Suspense } from "react";
import type { Equipement, TypeLogement } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Icone, Squelette } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { AccueilLogement } from "@/components/visiteur/accueil-logement";
import { CarteLogementListe } from "@/components/visiteur/carte-logement-liste";
import { BarreOutils } from "@/features/recherche/barre-outils";
import { PanneauFiltres } from "@/features/logement/panneau-filtres";
import { VueCarte } from "@/features/logement/vue-carte";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Traducteur } from "@/lib/i18n/traducteur";
import { formaterPlage, nombreDeNuits } from "@/lib/dates";
import { SEJOUR_DEFAUT } from "@/lib/dates/sejour";
import type { Logement } from "@teranga/contracts";
import { chercherLogements, ErreurServeur, type EtatSimule } from "@/mocks/api";

/**
 * Écran 2 · Résultats logement — maquette du parcours logement, écrans 02 et 07.
 *
 * Panneau de filtres à gauche, tri et bascule liste/carte au-dessus des
 * résultats. Tout l'état vit dans l'URL : la recherche se partage et survit au
 * retour arrière.
 *
 * Trois états se voient par la requête : `?etat=vide|erreur|lent`.
 */
type Params = Promise<{ locale: string }>;
type Recherche = Promise<Record<string, string | undefined>>;

export default async function Resultats({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Recherche;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const recherche = await searchParams;
  const t = traducteurPour(langue);

  // Pas de ville par défaut : le catalogue est surtout sur la Petite Côte, et
  // imposer Dakar en masquait les villas à qui n'avait rien demandé. Le champ
  // Destination garde ses suggestions, l'URL reste maîtresse.
  const ville = recherche.ville;
  const vue = recherche.vue === "carte" ? "carte" : "liste";

  // Sans critère, `/logements` est la page d'accueil du parcours (écran 01) ;
  // dès qu'un critère apparaît, la même adresse montre les résultats (écran 02).
  const CRITERES = [
    "ville", "debut", "fin", "personnes", "types", "quartiers",
    "equipements", "prixMin", "prixMax", "capacite", "tri", "vue", "etat",
  ];
  const cherche = CRITERES.some((c) => recherche[c]);

  if (!cherche) {
    // L'accueil du parcours doit s'afficher même si le catalogue est
    // indisponible : la recherche et les repères restent utiles, seule la
    // sélection « populaires » manque.
    let populaires: Logement[] = [];
    try {
      populaires = (
        await chercherLogements({ ville: recherche.ville, tri: "note" }, "normal", langue)
      ).elements.slice(0, 4);
    } catch (erreur) {
      if (!(erreur instanceof ErreurServeur)) throw erreur;
      console.error("[logements] sélection populaire indisponible", erreur);
    }

    return (
      <main className="bg-surface">
        <EnTeteSession />
        <AccueilLogement langue={langue} populaires={populaires} ville={recherche.ville} />
      </main>
    );
  }

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[92%] max-w-[1260px] pt-6">
        <nav aria-label={t("resultats.filAriane")} className="text-petit text-encre-douce">
          <Lien href="/" className="hover:text-encre">
            {t("resultats.filAriane")}
          </Lien>
          <span className="mx-2">›</span>
          <span className="text-encre">{t("resultats.filLogement")}</span>
        </nav>

        <Suspense key={JSON.stringify(recherche)} fallback={<Attente langue={langue} ville={ville} />}>
          <Contenu langue={langue} recherche={recherche} ville={ville} vue={vue} />
        </Suspense>
      </div>
    </main>
  );
}

async function Contenu({
  langue,
  recherche,
  ville,
  vue,
}: {
  langue: Langue;
  recherche: Record<string, string | undefined>;
  /** Absente quand le visiteur n'a pas choisi de destination. */
  ville?: string;
  vue: "liste" | "carte";
}) {
  const t = traducteurPour(langue);
  const separer = <T extends string>(v: string | undefined): T[] | undefined =>
    v ? (v.split(",").filter(Boolean) as T[]) : undefined;

  let resultats;
  try {
    resultats = await chercherLogements(
      {
        ville,
        personnes: recherche.personnes ? Number(recherche.personnes) : undefined,
        capaciteMin: recherche.capacite ? Number(recherche.capacite) : undefined,
        types: separer<TypeLogement>(recherche.types),
        equipements: separer<Equipement>(recherche.equipements),
        quartiers: separer(recherche.quartiers),
        prixMin: recherche.prixMin ? Number(recherche.prixMin) : undefined,
        prixMax: recherche.prixMax ? Number(recherche.prixMax) : undefined,
        tri: recherche.tri as "prix-croissant" | undefined,
      },
      (recherche.etat as EtatSimule) ?? "normal",
      langue,
    );
  } catch (erreur) {
    if (!(erreur instanceof ErreurServeur)) throw erreur;
    return (
      <div className="mt-6 space-y-4">
        <Bandeau variante="erreur">
          <strong className="block font-semibold">{t("resultats.erreurTitre")}</strong>
          {t("resultats.erreurTexte")}
        </Bandeau>
        <Lien href="/logements">
          <Bouton variante="secondaire" largeur="contenu" icone="information">
            {t("resultats.erreurAction")}
          </Bouton>
        </Lien>
      </div>
    );
  }

  const debut = recherche.debut ?? SEJOUR_DEFAUT.debut;
  const fin = recherche.fin ?? SEJOUR_DEFAUT.fin;
  const nuits = nombreDeNuits(new Date(`${debut}T00:00:00`), new Date(`${fin}T00:00:00`)) || 1;

  const suite = new URLSearchParams(
    Object.entries({ debut, fin, personnes: recherche.personnes }).filter(([, v]) => v) as [
      string,
      string,
    ][],
  ).toString();

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-titre-1 text-encre">
            {ville
              ? t("resultats.titreVille", { nombre: resultats.total, ville })
              : t("resultats.titre", { nombre: resultats.total })}
          </h1>
          <p className="mt-1 text-petit text-encre-douce">{t("resultats.sousTitreVille")}</p>
          <p className="mt-1 text-petit text-encre-douce chiffres-tabulaires">
            {formaterPlage(new Date(`${debut}T00:00:00`), new Date(`${fin}T00:00:00`), langue)}
          </p>
        </div>

        {vue === "liste" && (
          <Lien
            href={`/logements?${new URLSearchParams({ ...stringifier(recherche), vue: "carte" })}`}
            className="inline-flex min-h-[var(--size-control)] items-center gap-2 rounded-pill bg-champ px-5 text-petit font-semibold text-encre transition-colors hover:bg-contour/60"
          >
            <Icone nom="repere" taille={20} />
            {t("resultats.voirSurCarte")}
          </Lien>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        {/* Filtres : repliés dans un <details> sur téléphone, colonne fixe au-delà. */}
        <details className="group rounded-card border border-contour bg-surface lg:hidden" open={false}>
          <summary className="flex min-h-[var(--size-control)] cursor-pointer list-none items-center justify-between px-5 text-bouton text-encre">
            {t("resultats.filtres")}
            <Icone nom="chevron" taille={20} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-contour p-1">
            <Suspense fallback={null}>
              <PanneauFiltres facettes={resultats.facettes} />
            </Suspense>
          </div>
        </details>

        <aside className="hidden lg:block lg:sticky lg:top-6">
          <Suspense fallback={null}>
            <PanneauFiltres facettes={resultats.facettes} />
          </Suspense>
        </aside>

        <div>
          <Suspense fallback={null}>
            <BarreOutils vue={vue} />
          </Suspense>

          <div className="mt-5">
            {resultats.total === 0 ? (
              <Vide t={t} />
            ) : vue === "carte" ? (
              <VueCarte logements={resultats.elements} parametres={suite} />
            ) : (
              <ul className="space-y-4">
                {resultats.elements.map((logement) => (
                  <li key={logement.id}>
                    <CarteLogementListe logement={logement} nuits={nuits} parametres={suite} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {resultats.total > 0 && (
            <p className="mt-8 text-petit text-encre-douce">{t("resultats.paiementSurPlace")}</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Les paramètres de l'URL, nettoyés des valeurs vides. */
function stringifier(recherche: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(recherche).filter(([, v]) => v)) as Record<string, string>;
}

function Vide({ t }: { t: Traducteur }) {
  // « Jamais d'impasse » : l'état vide propose toujours une suite (§B.1).
  return (
    <Carte className="px-6 py-12 text-center">
      <Icone nom="recherche" taille={32} className="mx-auto text-encre-douce" />
      <h2 className="mt-4 text-titre-2 text-encre">{t("resultats.videTitre")}</h2>
      <p className="mx-auto mt-2 max-w-[48ch] text-corps text-encre-douce">
        {t("resultats.videTexte")}
      </p>
      <div className="mt-6 flex justify-center">
        <Lien href="/logements">
          <Bouton variante="principal" largeur="contenu">
            {t("resultats.videAction")}
          </Bouton>
        </Lien>
      </div>
    </Carte>
  );
}

function Attente({ langue, ville }: { langue: Langue; ville?: string }) {
  const t = traducteurPour(langue);
  return (
    <div className="mt-4">
      <p className="sr-only" role="status">
        {t("resultats.chargement")}
      </p>
      <Squelette className="h-9 w-[320px]" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Squelette className="hidden h-[520px] rounded-card lg:block" />
        <ul className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Carte className="flex flex-col sm:flex-row">
                <Squelette className="aspect-[4/3] w-full rounded-none sm:aspect-auto sm:h-[220px] sm:w-[260px]" />
                <div className="flex-1 space-y-2 p-5">
                  <Squelette className="h-5 w-20 rounded-pill" />
                  <Squelette className="h-6 w-2/3" />
                  <Squelette className="h-4 w-1/3" />
                  <Squelette className="h-4 w-1/2" />
                  <Squelette className="mt-3 h-6 w-2/5" />
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">{ville}</span>
    </div>
  );
}
