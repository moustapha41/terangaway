import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

/**
 * Lien — navigation secondaire (§C.3) : bleu nuit souligné, états normal et appuyé.
 *
 * Le composant ne connaît pas le routeur : `apps/web` l'enveloppe dans son propre
 * `Lien` qui préfixe la langue courante. Une URL ne se construit jamais depuis une
 * saisie libre (cahier des charges §11).
 */
export interface LienProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function Lien({ className, children, ...reste }: LienProps) {
  return (
    <a
      className={cn(
        "text-primaire underline underline-offset-2 transition-colors duration-[var(--duree-fast)]",
        "hover:text-primaire/80 active:text-primaire/70",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire",
        className,
      )}
      {...reste}
    >
      {children}
    </a>
  );
}
