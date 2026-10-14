import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

export type VarianteBouton = "principal" | "secondaire" | "confirmation" | "danger";

/**
 * Bouton — dossier de conception §C.3.
 *
 * Quatre variantes, quatre états : normal, appuyé, désactivé, en cours.
 * `confirmation` est réservé au bouton « Confirmer » : une seule couleur d'action
 * par écran (§A.4), le vert n'est jamais décoratif.
 *
 * Largeur jamais fixe (§C.5) : elle suit le texte ou l'écran. Le libellé peut
 * passer sur deux lignes — d'où `min-h` et non `h` — et n'est jamais tronqué.
 */
/**
 * « En cours » n'est pas « désactivé » : le bouton garde sa couleur et montre un
 * tourniquet. Les deux états sont donc décrits séparément, sinon l'attente ressemble
 * à un refus.
 */
const VARIANTES: Record<VarianteBouton, { actif: string; attente: string; eteint: string }> = {
  principal: {
    actif: "bg-primaire text-white hover:bg-primaire/90 active:bg-primaire/80",
    attente: "bg-primaire text-white",
    eteint: "bg-champ text-encre-douce",
  },
  secondaire: {
    actif: "border border-primaire bg-surface text-primaire hover:bg-teinte-bleu active:bg-teinte-bleu/70",
    attente: "border border-primaire bg-surface text-primaire",
    eteint: "border border-contour bg-surface text-encre-douce",
  },
  confirmation: {
    actif: "bg-succes text-white hover:bg-succes/90 active:bg-succes/80",
    attente: "bg-succes text-white",
    eteint: "bg-champ text-encre-douce",
  },
  danger: {
    actif: "border border-danger bg-surface text-danger hover:bg-teinte-rouge active:bg-teinte-rouge/70",
    attente: "border border-danger bg-surface text-danger",
    eteint: "border border-contour bg-surface text-encre-douce",
  },
};

export interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  /** Icône à gauche du libellé. Jamais seule : une icône d'action va avec un mot (§A.6). */
  icone?: NomIcone;
  /** Affiche le tourniquet et bloque le clic, sans retirer le libellé. */
  enCours?: boolean;
  /** Pleine largeur sur téléphone, largeur du contenu à partir de `sm` (défaut). */
  largeur?: "adaptative" | "pleine" | "contenu";
  children: ReactNode;
}

export function Bouton({
  variante = "principal",
  icone,
  enCours = false,
  largeur = "adaptative",
  disabled,
  className,
  children,
  ...reste
}: BoutonProps) {
  const apparence = enCours
    ? VARIANTES[variante].attente
    : disabled
      ? VARIANTES[variante].eteint
      : VARIANTES[variante].actif;

  return (
    <button
      type="button"
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      className={cn(
        "inline-flex min-h-[var(--size-control)] items-center justify-center gap-2 rounded-control px-4",
        "text-bouton transition-colors duration-[var(--duree-fast)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire",
        "disabled:cursor-not-allowed",
        largeur === "pleine" && "w-full",
        largeur === "adaptative" && "w-full sm:w-auto",
        apparence,
        className,
      )}
      {...reste}
    >
      {enCours ? <Tourniquet /> : icone ? <Icone nom={icone} taille={20} /> : null}
      <span>{children}</span>
    </button>
  );
}

/** Désactivé si le téléphone demande moins d'animations — la règle est dans globals.css. */
function Tourniquet() {
  return (
    <span
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent"
    />
  );
}
