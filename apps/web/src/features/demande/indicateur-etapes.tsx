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
                    "absolute -left-1/2 top-3.5 sm:top-4 h-[2px] w-full " +
                    (faite
                      ? "bg-primaire"
                      : active
                        ? "bg-gradient-to-r from-primaire to-primaire/30"
                        : "bg-contour")
                  }
                />
              )}

              <span
                className={
                  "relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-pill text-[12px] sm:text-[13px] font-semibold transition-all " +
                  (faite
                    ? "bg-primaire text-white shadow-sm"
                    : active
                      ? "border-2 border-jaune-vif bg-primaire text-white shadow-md ring-4 ring-jaune-vif/25"
                      : "border border-contour bg-surface text-encre-douce")
                }
              >
                {faite ? <Icone nom="coche-cercle" taille={20} /> : rang}
              </span>

              <span
                className={
                  "mt-1.5 text-center transition-colors " +
                  (active
                    ? "font-bold text-primaire text-[12px] sm:text-[12.5px]"
                    : faite
                      ? "font-semibold text-encre text-[12px] sm:text-[12.5px]"
                      : "text-encre-douce text-[11px] sm:text-[11.5px]")
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
