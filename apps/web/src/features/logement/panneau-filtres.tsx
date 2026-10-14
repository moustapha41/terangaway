"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EQUIPEMENTS, TYPES_LOGEMENT, type Facettes } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { formaterMontant } from "@/lib/prix";

/**
 * Panneau de filtres — maquette du parcours logement, écran 02.
 *
 * Tout l'état vit dans l'URL : un résultat filtré se partage, se recharge et
 * survit au retour arrière (§B.1).
 *
 * Les compteurs viennent des facettes calculées sur le catalogue entier, pas sur
 * les résultats courants : sinon cocher un filtre ferait tomber tous les autres
 * à zéro, et le panneau ne servirait plus à rien.
 */
const VISIBLES = 5;

export function PanneauFiltres({ facettes }: { facettes: Facettes }) {
  const t = useT();
  const langue = useLangue();
  const router = useRouter();
  const params = useSearchParams();
  const [, demarrer] = useTransition();

  const [rechercheQuartier, setRechercheQuartier] = useState("");
  const [toutQuartiers, setToutQuartiers] = useState(false);
  const [toutEquipements, setToutEquipements] = useState(false);

  const liste = (nom: string) => params.get(nom)?.split(",").filter(Boolean) ?? [];

  const ecrire = (modifier: (p: URLSearchParams) => void) => {
    const suivants = new URLSearchParams(params.toString());
    modifier(suivants);
    demarrer(() => router.replace(`?${suivants.toString()}`, { scroll: false }));
  };

  const basculer = (nom: string, valeur: string) =>
    ecrire((p) => {
      const set = new Set(liste(nom));
      if (set.has(valeur)) set.delete(valeur);
      else set.add(valeur);
      if (set.size) p.set(nom, [...set].join(","));
      else p.delete(nom);
    });

  const poser = (nom: string, valeur: string | null) =>
    ecrire((p) => (valeur ? p.set(nom, valeur) : p.delete(nom)));

  const quartiers = Object.entries(facettes.quartiers)
    .filter(([q]) => q.toLowerCase().includes(rechercheQuartier.toLowerCase()))
    .sort((a, b) => b[1] - a[1]);

  const equipements = EQUIPEMENTS.filter((e) => facettes.equipements[e]);

  const actifs =
    liste("types").length + liste("quartiers").length + liste("equipements").length +
    (params.get("prixMin") ? 1 : 0) + (params.get("prixMax") ? 1 : 0) +
    (params.get("capacite") ? 1 : 0);

  return (
    <div className="rounded-card border border-contour bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-titre-3 text-encre">
          <Icone nom="filtre" taille={20} />
          {t("resultats.filtres")}
        </h2>
        {actifs > 0 && (
          <button
            type="button"
            onClick={() =>
              ecrire((p) =>
                ["types", "quartiers", "equipements", "prixMin", "prixMax", "capacite"].forEach((c) =>
                  p.delete(c),
                ),
              )
            }
            className="text-petit font-semibold text-primaire underline underline-offset-2"
          >
            {t("resultats.reinitialiser")}
          </button>
        )}
      </div>

      {/* Type de logement */}
      <Section titre={t("resultats.typeLogement")}>
        <Case
          libelle={t("resultats.tous")}
          compte={facettes.total}
          coche={liste("types").length === 0}
          onChange={() => poser("types", null)}
        />
        {TYPES_LOGEMENT.filter((type) => facettes.types[type]).map((type) => (
          <Case
            key={type}
            libelle={t(`typeLogement.${type}`)}
            compte={facettes.types[type]}
            coche={liste("types").includes(type)}
            onChange={() => basculer("types", type)}
          />
        ))}
      </Section>

      {/* Prix par nuit */}
      <Section titre={t("resultats.prixParNuit")}>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-control bg-champ px-3 py-1.5 text-petit text-encre chiffres-tabulaires">
            {formaterMontant(Number(params.get("prixMin") ?? facettes.prix.min), langue)}
          </span>
          <span className="rounded-control bg-champ px-3 py-1.5 text-petit text-encre chiffres-tabulaires">
            {formaterMontant(Number(params.get("prixMax") ?? facettes.prix.max), langue)}
          </span>
        </div>

        {/* Deux curseurs plutôt qu'un contrôle maison : chacun reste annonçable
            et manipulable au clavier, ce qu'un double curseur dessiné perd. */}
        <div className="mt-3 space-y-3">
          <Curseur
            libelle={t("resultats.prixMin")}
            min={facettes.prix.min}
            max={facettes.prix.max}
            valeur={Number(params.get("prixMin") ?? facettes.prix.min)}
            onChange={(v) => poser("prixMin", v > facettes.prix.min ? String(v) : null)}
          />
          <Curseur
            libelle={t("resultats.prixMax")}
            min={facettes.prix.min}
            max={facettes.prix.max}
            valeur={Number(params.get("prixMax") ?? facettes.prix.max)}
            onChange={(v) => poser("prixMax", v < facettes.prix.max ? String(v) : null)}
          />
        </div>
      </Section>

      {/* Localisation */}
      <Section titre={t("resultats.localisation")}>
        <label className="mb-2 flex min-h-[var(--size-control)] items-center gap-2 rounded-control border border-contour-champ px-3">
          <Icone nom="recherche" taille={20} className="shrink-0 text-encre-douce" />
          <input
            value={rechercheQuartier}
            onChange={(e) => setRechercheQuartier(e.target.value)}
            placeholder={t("resultats.chercherQuartier")}
            aria-label={t("resultats.chercherQuartier")}
            className="min-w-0 flex-1 bg-transparent text-petit text-encre outline-none placeholder:text-encre-douce"
          />
        </label>

        {(toutQuartiers ? quartiers : quartiers.slice(0, VISIBLES)).map(([quartier, compte]) => (
          <Case
            key={quartier}
            libelle={quartier}
            compte={compte}
            coche={liste("quartiers").includes(quartier)}
            onChange={() => basculer("quartiers", quartier)}
          />
        ))}
        {quartiers.length > VISIBLES && (
          <Plus ouvert={toutQuartiers} onClick={() => setToutQuartiers((v) => !v)} t={t} />
        )}
      </Section>

      {/* Équipements */}
      <Section titre={t("resultats.equipements")}>
        {(toutEquipements ? equipements : equipements.slice(0, VISIBLES)).map((equipement) => (
          <Case
            key={equipement}
            libelle={t(`equipement.${equipement}`)}
            compte={facettes.equipements[equipement]}
            coche={liste("equipements").includes(equipement)}
            onChange={() => basculer("equipements", equipement)}
          />
        ))}
        {equipements.length > VISIBLES && (
          <Plus ouvert={toutEquipements} onClick={() => setToutEquipements((v) => !v)} t={t} />
        )}
      </Section>

      {/* Capacité */}
      <Section titre={t("resultats.capacite")}>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const actif = params.get("capacite") === String(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={actif}
                onClick={() => poser("capacite", actif ? null : String(n))}
                className={
                  "min-h-[var(--size-touch)] min-w-[48px] rounded-control border px-3 text-petit font-semibold chiffres-tabulaires " +
                  (actif
                    ? "border-primaire bg-primaire text-white"
                    : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                }
              >
                {t("resultats.capaciteOption", { nombre: n })}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-contour pt-5 first-of-type:mt-5">
      <h3 className="mb-3 text-petit font-semibold text-encre">{titre}</h3>
      {children}
    </section>
  );
}

function Case({
  libelle,
  compte,
  coche,
  onChange,
}: {
  libelle: string;
  compte: number;
  coche: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-[var(--size-touch)] cursor-pointer items-center gap-3 text-petit text-encre">
      <input
        type="checkbox"
        checked={coche}
        onChange={onChange}
        className="h-[18px] w-[18px] shrink-0 accent-[var(--color-primaire)]"
      />
      <span className="flex-1">{libelle}</span>
      <span className="text-encre-douce chiffres-tabulaires">({compte})</span>
    </label>
  );
}

function Curseur({
  libelle,
  min,
  max,
  valeur,
  onChange,
}: {
  libelle: string;
  min: number;
  max: number;
  valeur: number;
  onChange: (valeur: number) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{libelle}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={5000}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[var(--size-touch)] w-full accent-[var(--color-primaire)]"
      />
    </label>
  );
}

function Plus({
  ouvert,
  onClick,
  t,
}: {
  ouvert: boolean;
  onClick: () => void;
  t: (cle: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 text-petit font-semibold text-primaire underline underline-offset-2"
    >
      {ouvert ? t("resultats.voirMoins") : t("resultats.voirPlus")}
    </button>
  );
}
