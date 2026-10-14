import { Icone } from "@teranga/ui";

/**
 * Indicateur d'étapes — maquette écrans 09 à 11.
 *
 * Une liste ordonnée, pas une rangée de pastilles : l'ordre est l'information,
 * et un lecteur d'écran doit l'entendre comme une suite. L'étape courante porte
 * `aria-current`, et la position est redite en toutes lettres — un cercle bleu
 * ne s'entend pas.
 */
export function IndicateurEtapes({
  etapes,
  courante,
  resume,
}: {
  etapes: string[];
  /** Index de l'étape en cours, à partir de 1. */
  courante: number;
  /** « Étape 2 sur 3 », déjà traduit. */
  resume: string;
}) {
  return (
    <nav aria-label={resume}>
      <p className="sr-only">{resume}</p>
      <ol className="flex items-start">
        {etapes.map((etape, i) => {
          const rang = i + 1;
          const faite = rang < courante;
          const active = rang === courante;
          return (
            <li
              key={etape}
              aria-current={active ? "step" : undefined}
              className={"flex flex-1 flex-col items-center" + (i === 0 ? "" : " relative")}
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={
                    "absolute -left-1/2 top-4 h-px w-full " +
                    (faite || active ? "bg-primaire/40" : "bg-contour")
                  }
                />
              )}

              <span
                className={
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-pill text-petit font-semibold " +
                  (faite || active
                    ? "bg-primaire text-white"
                    : "border border-contour bg-surface text-encre-douce")
                }
              >
                {faite ? <Icone nom="coche-cercle" taille={20} /> : rang}
              </span>

              <span
                className={
                  "mt-2 text-center text-legende " +
                  (active ? "font-semibold text-encre" : "text-encre-douce")
                }
              >
                {etape}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
