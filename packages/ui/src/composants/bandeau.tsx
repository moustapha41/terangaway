import type { ReactNode } from "react";
import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

export type VarianteBandeau =
  | "information"
  | "succes"
  | "avertissement"
  | "erreur"
  | "hors-connexion";

/**
 * Bandeau — message d'écran, cinq variantes (§C.3).
 *
 * Le bandeau « hors connexion » se pose en haut de l'écran et s'accompagne de la
 * désactivation de l'envoi, qui se réactive au retour du réseau (§B.7).
 */
const VARIANTES: Record<VarianteBandeau, { fond: string; icone: NomIcone; role?: "alert" | "status" }> = {
  information: { fond: "bg-teinte-bleu text-primaire", icone: "information" },
  succes: { fond: "bg-teinte-vert text-succes", icone: "coche-cercle", role: "status" },
  avertissement: { fond: "bg-teinte-orange text-alerte", icone: "alerte", role: "status" },
  erreur: { fond: "bg-teinte-rouge text-danger", icone: "alerte", role: "alert" },
  "hors-connexion": { fond: "bg-teinte-gris text-encre-douce", icone: "hors-connexion", role: "status" },
};

export function Bandeau({
  variante = "information",
  children,
  action,
  className,
}: {
  variante?: VarianteBandeau;
  children: ReactNode;
  /** Action éventuelle à droite : « Réessayer », « Voir ma demande »… */
  action?: ReactNode;
  className?: string;
}) {
  const { fond, icone, role } = VARIANTES[variante];
  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-control px-4 py-3 text-petit", fond, className)}
    >
      <Icone nom={icone} taille={20} className="mt-px shrink-0" />
      <p className="flex-1">{children}</p>
      {action}
    </div>
  );
}
