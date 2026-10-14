import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

export interface PartAnneau {
  cle: string;
  libelle: string;
  valeur: number;
  couleur: string;
  icone?: NomIcone;
}

/**
 * Anneau de répartition — part d'un tout, quatre catégories au plus.
 *
 * Trois règles en font un graphique lisible plutôt qu'un camembert décoratif :
 *
 *  - **Un écart de 2 px entre les parts.** Deux aplats qui se touchent se lisent
 *    comme un seul quand on distingue mal les couleurs.
 *  - **La légende porte le libellé, l'icône et le chiffre.** La couleur ne
 *    transporte jamais l'information à elle seule ; la palette passe le contrôle
 *    de daltonisme, mais à la condition expresse d'un étiquetage direct.
 *  - **Le total est écrit au centre**, pas déduit de la taille des parts.
 *
 * Au-delà de quatre parts, l'anneau cesse d'être lisible : regrouper le reste
 * sous « Autres » plutôt que d'ajouter des teintes.
 */
export function Anneau({
  parts,
  total,
  libelleTotal,
  etiquette,
  className,
}: {
  parts: PartAnneau[];
  total: number;
  libelleTotal: string;
  /** Ce que l'anneau représente, pour les lecteurs d'écran. */
  etiquette: string;
  className?: string;
}) {
  const RAYON = 70;
  const EPAISSEUR = 18;
  const circonference = 2 * Math.PI * RAYON;
  const ECART = 2; // px de surface entre deux parts

  const somme = parts.reduce((s, p) => s + p.valeur, 0) || 1;
  let parcouru = 0;

  return (
    <figure className={cn("flex flex-col items-center gap-5 sm:flex-row sm:gap-8", className)}>
      <div className="relative shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={etiquette}>
          <circle cx="90" cy="90" r={RAYON} fill="none" stroke="var(--color-champ)" strokeWidth={EPAISSEUR} />
          {parts.map((part) => {
            const longueur = (part.valeur / somme) * circonference;
            const trait = Math.max(0, longueur - ECART);
            const decalage = -parcouru;
            parcouru += longueur;
            if (part.valeur === 0) return null;
            return (
              <circle
                key={part.cle}
                cx="90"
                cy="90"
                r={RAYON}
                fill="none"
                stroke={part.couleur}
                strokeWidth={EPAISSEUR}
                strokeDasharray={`${trait} ${circonference - trait}`}
                strokeDashoffset={decalage}
                transform="rotate(-90 90 90)"
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[30px] font-semibold leading-none text-encre chiffres-tabulaires">
            {total}
          </span>
          <span className="mt-1 text-legende text-encre-douce">{libelleTotal}</span>
        </div>
      </div>

      {/* La légende est la vraie lecture du graphique : libellé, icône, chiffre. */}
      <figcaption className="w-full">
        <ul className="space-y-2">
          {parts.map((part) => (
            <li key={part.cle} className="flex items-center gap-2.5 text-petit">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ backgroundColor: part.couleur }}
              />
              {part.icone && <Icone nom={part.icone} taille={16} className="shrink-0 text-encre-douce" />}
              <span className="flex-1 text-encre">{part.libelle}</span>
              <span className="font-semibold text-encre chiffres-tabulaires">{part.valeur}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
