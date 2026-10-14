import { cn } from "../cn";

/**
 * Squelette de chargement — « formes grises de la carte ou de la fiche » (§B.7).
 * Il prend la forme de ce qu'il remplace, jamais un tourniquet générique.
 */
export function Squelette({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block animate-pulse rounded-control bg-champ", className)}
    />
  );
}
