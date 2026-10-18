"use client";

import { useMemo, useState } from "react";
import { Bouton, Icone, type NomIcone } from "@teranga/ui";
import { CarteTuiles } from "@/lib/carte/carte-tuiles";
import { Lien } from "@/lib/i18n/lien";
import { useT } from "@/lib/i18n/contexte";
import {
  CATEGORIES_TRESOR,
  TRESORS,
  type CategorieTresor,
  type Tresor,
} from "./tresors";

/** L'icône qui va avec chaque famille de sites. */
const ICONES: Record<CategorieTresor, NomIcone> = {
  memoire: "repere",
  nature: "globe",
  culture: "visite",
  spiritualite: "etoile",
};

/**
 * Les trésors du Sénégal : filtres, fiches et carte.
 *
 * Un site se lit en trois temps — ce que c'est, comment y aller, ce qu'un
 * habitant conseille —, et la carte montre où il se trouve dans le pays, ce
 * qu'une liste de kilomètres ne dit jamais vraiment.
 *
 * La fiche ouverte vit **dans l'état**, pas dans l'adresse : on ouvre et on
 * referme beaucoup en parcourant, et chaque ouverture aurait sinon empilé une
 * entrée dans l'historique du navigateur. Le lien de demande, lui, porte le
 * site dans son adresse : celui-là se partage et survit au rechargement.
 */
export function GalerieTresors() {
  const t = useT();
  const [filtre, setFiltre] = useState<CategorieTresor | "tous">("tous");
  const [choisi, setChoisi] = useState<string | null>(null);

  const visibles = useMemo(
    () => (filtre === "tous" ? TRESORS : TRESORS.filter((t) => t.categorie === filtre)),
    [filtre],
  );

  // Le site ouvert doit rester visible : changer de filtre referme la fiche
  // plutôt que de laisser un détail orphelin sous une liste qui ne le contient
  // plus.
  const ouvert = visibles.find((tresor) => tresor.cle === choisi) ?? null;

  const nom = (tresor: Tresor) => t(`guides.tresor.${tresor.cle}Nom`);

  return (
    <div>
      {/* filtres par famille */}
      <div className="flex flex-wrap gap-2">
        {(["tous", ...CATEGORIES_TRESOR] as const).map((categorie) => {
          const actif = filtre === categorie;
          const libelle =
            categorie === "tous"
              ? t("guides.filtreTous")
              : t(`guides.categorie${categorie[0].toUpperCase()}${categorie.slice(1)}`);
          return (
            <button
              key={categorie}
              type="button"
              aria-pressed={actif}
              onClick={() => {
                setFiltre(categorie);
                setChoisi(null);
              }}
              className={
                "inline-flex min-h-[var(--size-touch)] items-center rounded-pill border px-4 text-petit font-semibold transition-colors " +
                (actif
                  ? "border-primaire bg-primaire text-white"
                  : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
              }
            >
              {libelle}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* la liste des sites */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {visibles.map((tresor) => {
            const actif = ouvert?.cle === tresor.cle;
            return (
              <li key={tresor.cle}>
                <button
                  type="button"
                  aria-expanded={actif}
                  onClick={() => setChoisi(actif ? null : tresor.cle)}
                  className={
                    "flex w-full gap-3 rounded-card border p-4 text-left transition-colors " +
                    (actif
                      ? "border-primaire bg-teinte-bleu"
                      : "border-contour bg-surface hover:border-primaire/40")
                  }
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-teinte-bleu text-primaire">
                    <Icone nom={ICONES[tresor.categorie]} taille={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-petit font-semibold text-encre">
                      {nom(tresor)}
                    </span>
                    <span className="mt-0.5 block text-legende text-encre-douce">
                      {t(`guides.tresor.${tresor.cle}Acces`)}
                    </span>
                    {tresor.unesco !== undefined && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-pill bg-teinte-jaune px-2 py-0.5 text-legende font-semibold text-jaune-fonce">
                        {t("guides.unesco", { annee: String(tresor.unesco) })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* la carte, et la fiche du site ouvert */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CarteTuiles
            className="h-[320px] w-full overflow-hidden rounded-card border border-contour sm:h-[380px]"
            etiquette={t("guides.carteEtiquette")}
            reperes={visibles.map((tresor) => ({
              id: tresor.cle,
              latitude: tresor.latitude,
              longitude: tresor.longitude,
              libelle: nom(tresor),
              actif: ouvert?.cle === tresor.cle,
              onClick: () => setChoisi(tresor.cle),
            }))}
          />
          <p className="mt-2 text-legende text-encre-douce">{t("guides.carteNote")}</p>

          {ouvert && (
            <article className="mt-4 rounded-card border border-contour bg-surface p-5">
              <h3 className="text-titre-2 text-encre">{nom(ouvert)}</h3>

              <p className="mt-3 text-corps leading-relaxed text-encre-douce">
                {t(`guides.tresor.${ouvert.cle}Histoire`)}
              </p>

              <dl className="mt-4 space-y-3 border-t border-contour pt-4">
                <div>
                  <dt className="text-legende font-semibold uppercase tracking-[0.12em] text-encre-douce">
                    {t("guides.accesTitre")}
                  </dt>
                  <dd className="mt-0.5 text-petit text-encre">
                    {t(`guides.tresor.${ouvert.cle}Acces`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-legende font-semibold uppercase tracking-[0.12em] text-encre-douce">
                    {t("guides.conseilTitre")}
                  </dt>
                  <dd className="mt-0.5 text-petit text-encre">
                    {t(`guides.tresor.${ouvert.cle}Conseil`)}
                  </dd>
                </div>
              </dl>

              {/* Le site voyage dans l'adresse : le formulaire plus bas s'ouvre
                  avec le message déjà amorcé, et le lien se partage tel quel. */}
              <Lien href={`/services/guides?site=${ouvert.cle}#demande`} className="mt-5 block">
                <Bouton variante="principal" largeur="contenu">
                  <span className="inline-flex items-center gap-2">
                    {t("guides.demanderPour")}
                    <Icone nom="chevron-droite" taille={16} />
                  </span>
                </Bouton>
              </Lien>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
