import { STATUTS, type Statut } from "@teranga/tokens";
import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

export interface EtapeFrise {
  statut: Statut;
  libelle: string;
  /** Horodatage déjà formaté par l'application, qui seule connaît la langue. */
  horodatage?: string;
  etat: "faite" | "en-cours" | "a-venir";
}

/**
 * Frise de statut — étapes verticales avec horodatage, l'étape en cours mise en
 * avant (§C.3).
 *
 * `<ol>` et non une suite de `<div>` : l'ordre des étapes est l'information
 * principale, et un lecteur d'écran doit l'entendre comme une liste ordonnée.
 * L'étape en cours porte `aria-current`, sinon elle n'est signalée que par la
 * graisse — ce qui ne s'entend pas.
 */
export function FriseStatut({ etapes, className }: { etapes: EtapeFrise[]; className?: string }) {
  return (
    <ol className={cn("space-y-0", className)}>
      {etapes.map((etape, i) => {
        const dernier = i === etapes.length - 1;
        const couleur = COULEURS[etape.etat];
        return (
          <li
            key={etape.statut}
            aria-current={etape.etat === "en-cours" ? "step" : undefined}
            className="flex gap-4"
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill",
                  couleur.pastille,
                )}
              >
                <Icone nom={STATUTS[etape.statut].icone as NomIcone} taille={16} />
              </span>
              {!dernier && (
                <span
                  aria-hidden="true"
                  className={cn("w-px flex-1", etape.etat === "a-venir" ? "bg-contour" : "bg-primaire/30")}
                />
              )}
            </div>

            <div className={cn("pb-6", dernier && "pb-0")}>
              <p className={cn("text-corps", couleur.texte)}>{etape.libelle}</p>
              {etape.horodatage && (
                <p className="mt-0.5 text-legende text-encre-douce chiffres-tabulaires">
                  {etape.horodatage}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const COULEURS = {
  faite: { pastille: "bg-teinte-bleu text-primaire", texte: "text-encre-douce" },
  "en-cours": { pastille: "bg-primaire text-white", texte: "font-semibold text-encre" },
  "a-venir": { pastille: "bg-champ text-encre-douce", texte: "text-encre-douce" },
} as const;
