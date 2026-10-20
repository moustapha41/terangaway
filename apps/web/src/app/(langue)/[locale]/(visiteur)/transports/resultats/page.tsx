import { Suspense } from "react";
import Image from "next/image";
import type { Vehicule } from "@teranga/contracts";
import { Bouton, Carte, Icone } from "@teranga/ui";
import { EnTeteSession } from "@/components/layout/en-tete-session";
import { PanneauFiltresTransport } from "@/features/transport/panneau-filtres-transport";
import { VueCarteTransport } from "@/features/transport/vue-carte-transport";
import { BarreOutils } from "@/features/recherche/barre-outils";
import { formaterDateComplete, formaterHeure } from "@/lib/dates";
import { Lien } from "@/lib/i18n/lien";
import { estLangue, type Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";
import { formaterPrixVisiteur } from "@/lib/prix";
import { chercherVehicules, facettesVehicules } from "@/mocks/api";

/**
 * Résultats transport — maquette transport, écran 2.
 *
 * Un seul écran pour les quatre services, filtré par « type de service » :
 * c'est ce que montre la maquette, et c'est plus juste que trois pages
 * séparées — un visiteur qui cherche à aller de l'aéroport au Plateau se moque
 * de savoir si cela s'appelle un transfert ou un taxi.
 *
 * Tout l'état est dans l'URL : la recherche se partage et survit au
 * rechargement. Le filtrage se fait au rendu serveur, donc la page est juste
 * même avant l'hydratation.
 */
type Recherche = Promise<Record<string, string | undefined>>;

/**
 * Les critères de l'URL deviennent ceux de l'API.
 *
 * Le filtrage et les compteurs vivaient ici, sur le catalogue importé en
 * direct : la page répondait donc même sans API, en montrant des données
 * figées. Elle passe désormais par la couture, comme tout le reste.
 */
function prixDe(v: Vehicule) {
  return v.prixParTrajet ?? v.prixParJour ?? 0;
}

function criteresDepuis(r: Record<string, string | undefined>) {
  const liste = (nom: string) => {
    const v = (r[nom] ?? "").split(",").filter(Boolean);
    return v.length > 0 ? v : undefined;
  };
  const PLAGES: Record<string, [number, number]> = {
    "1-3": [1, 3],
    "4-6": [4, 6],
    "7+": [7, 99],
  };
  const plage = PLAGES[r.places ?? ""];

  return {
    categories: liste("categorie"),
    passagers: plage ? plage[0] : r.passagers ? Number(r.passagers) : undefined,
    prixMin: r.prixMin ? Number(r.prixMin) : undefined,
    prixMax: r.prixMax ? Number(r.prixMax) : undefined,
  };
}

export default async function Resultats({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Recherche;
}) {
  const { locale } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const r = await searchParams;
  const t = traducteurPour(langue);

  const vue = r.vue === "carte" ? "carte" : "liste";
  const besoin = r.service === "location-avec-chauffeur" ? "location" : "trajet";

  // La liste et les compteurs viennent de la même source : l'API filtre, et
  // calcule les facettes sur le périmètre du besoin.
  const [retenus, comptes] = await Promise.all([
    chercherVehicules(besoin, criteresDepuis(r)),
    facettesVehicules(besoin, criteresDepuis(r)),
  ]);

  const tri = r.tri ?? "pertinence";
  const classes = [...retenus].sort((a, b) => {
    if (tri === "prix-croissant") return prixDe(a) - prixDe(b);
    if (tri === "prix-decroissant") return prixDe(b) - prixDe(a);
    if (tri === "places") return b.placesPassagers - a.placesPassagers;
    return 0;
  });

  const quand = r.quand ? new Date(r.quand) : null;

  return (
    <main className="bg-page pb-16">
      <EnTeteSession />

      <div className="mx-auto w-[92%] max-w-[1260px] pt-6">
        <nav className="flex items-center gap-2 text-petit text-encre-douce">
          <Lien href="/" className="hover:text-primaire">
            {t("navigation.accueil")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <Lien href="/transports" className="hover:text-primaire">
            {t("entete.transports")}
          </Lien>
          <Icone nom="chevron-droite" taille={16} />
          <span className="text-encre">{t("resultatsTransport.fil")}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-titre-1 text-encre">
              {t(classes.length > 1 ? "resultatsTransport.titrePluriel" : "resultatsTransport.titre", {
                nombre: classes.length,
              })}
            </h1>
            {(r.depart || quand) && (
              <p className="mt-1 text-petit text-encre-douce">
                {r.depart &&
                  t("resultatsTransport.resume", {
                    depart: r.depart,
                    arrivee: r.arrivee ?? "—",
                  })}
                {r.depart && quand ? " · " : ""}
                {quand &&
                  t("resultatsTransport.resumeQuand", {
                    quand: `${formaterDateComplete(quand, langue)} ${formaterHeure(quand, langue)}`,
                    voyageurs: t("resultatsTransport.voyageursCompte", {
                      nombre: Number(r.passagers ?? 2),
                    }),
                  })}
              </p>
            )}
          </div>

          <Lien href="/transports">
            <Bouton variante="secondaire" largeur="contenu" icone="recherche">
              {t("resultatsTransport.modifier")}
            </Bouton>
          </Lien>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside>
            <Suspense fallback={null}>
              <PanneauFiltresTransport comptes={comptes} />
            </Suspense>
          </aside>

          <section>
            <Suspense fallback={null}>
              <BarreOutils
                vue={vue}
                tris={["pertinence", "prix-croissant", "prix-decroissant", "places"]}
              />
            </Suspense>

            {vue === "carte" && classes.length > 0 ? (
              <div className="mt-5">
                <VueCarteTransport
                  vehicules={classes}
                  parametres={new URLSearchParams(
                    Object.entries(r).filter(
                      (paire): paire is [string, string] =>
                        paire[1] !== undefined && paire[0] !== "vue",
                    ),
                  ).toString()}
                />
              </div>
            ) : classes.length === 0 ? (
              <Carte className="mt-5 p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-champ text-encre-douce">
                  <Icone nom="recherche" taille={24} />
                </span>
                <p className="mt-3 text-titre-3 text-encre">
                  {t("resultatsTransport.aucunResultat")}
                </p>
                <p className="mt-2 text-petit text-encre-douce">
                  {t("resultatsTransport.aucunResultatTexte")}
                </p>
                <div className="mx-auto mt-5 max-w-[280px]">
                  <Lien href="/transports/resultats">
                    <Bouton variante="secondaire" largeur="pleine">
                      {t("resultatsTransport.toutVoir")}
                    </Bouton>
                  </Lien>
                </div>
              </Carte>
            ) : (
              <ul className="mt-5 space-y-4">
                {classes.map((v) => (
                  <li key={v.id}>
                    <CarteResultat vehicule={v} langue={langue} r={r} t={t} />
                  </li>
                ))}
              </ul>
            )}

          </section>
        </div>
      </div>
    </main>
  );
}

function CarteResultat({
  vehicule,
  langue,
  r,
  t,
}: {
  vehicule: Vehicule;
  langue: Langue;
  r: Record<string, string | undefined>;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}) {
  // Le contexte de recherche suit jusqu'à la fiche, puis jusqu'à la demande.
  const contexte = new URLSearchParams();
  for (const nom of ["depart", "arrivee", "quand", "passagers"]) {
    if (r[nom]) contexte.set(nom, r[nom]!);
  }

  const chips = [
    { icone: "personnes" as const, texte: t("transport.places", { nombre: vehicule.placesPassagers }) },
    { icone: "bagage" as const, texte: t("transport.bagagesNombre", { nombre: vehicule.bagages }) },
    ...(vehicule.climatisation
      ? [{ icone: "climatisation" as const, texte: t("equipement.climatisation") }]
      : []),
  ];

  return (
    <Carte className="overflow-hidden transition-shadow hover:shadow-[0_14px_32px_-12px_rgb(2_20_38/0.2)]">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-[4/3] w-full shrink-0 bg-champ sm:aspect-auto sm:h-auto sm:w-[232px]">
          <Image
            src={vehicule.photos[0].url}
            alt={vehicule.photos[0].alt}
            fill
            sizes="(max-width: 640px) 100vw, 232px"
            className="object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-teinte-bleu px-2.5 py-1 text-legende font-semibold text-primaire">
              <Icone nom="verification" taille={16} />
              {t(`offreTransport.${vehicule.offresProposees[0]}`)}
            </span>

            <h2 className="mt-2 text-titre-3 text-encre">
              {vehicule.marque} {vehicule.modele}
            </h2>
            <p className="mt-0.5 text-petit text-encre-douce">
              {t(`categorieVehicule.${vehicule.categorie}`)} · {vehicule.annee}
            </p>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-legende text-encre-douce">
              {chips.map((c) => (
                <li key={c.texte} className="inline-flex items-center gap-1.5">
                  <Icone nom={c.icone} taille={16} />
                  {c.texte}
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-titre-3 text-encre chiffres-tabulaires">
              {formaterPrixVisiteur(prixDe(vehicule), langue)}
            </p>
            <p className="text-legende text-encre-douce">
              {vehicule.prixParTrajet ? t("transport.parTrajet") : t("transport.parJour")}
            </p>
            <div className="mt-3">
              <Lien href={`/transports/${vehicule.slug}?${contexte.toString()}`}>
                <Bouton variante="principal" largeur="contenu">
                  {t("resultatsTransport.voirDetails")}
                </Bouton>
              </Lien>
            </div>
          </div>
        </div>
      </div>
    </Carte>
  );
}
