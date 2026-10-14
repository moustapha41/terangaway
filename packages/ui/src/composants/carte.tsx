import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Carte — surface de base des résultats, des fiches et des demandes.
 * La séparation se fait par la bordure et l'espace, pas par l'ombre (§A.4) :
 * l'ombre de l'accueil reste cantonnée à l'accueil.
 */
export function Carte({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-contour bg-surface", className)}>
      {children}
    </div>
  );
}
