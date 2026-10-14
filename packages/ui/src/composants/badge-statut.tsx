import { STATUTS, type Statut } from "@teranga/tokens";
import { cn } from "../cn";
import { Icone, type NomIcone } from "../icones";

/**
 * Badge de statut — les 7 états d'une demande (§C.3).
 *
 * Icône **et** mot, toujours : une couleur ne porte jamais seule l'information
 * (§A.4, et §C.6 pour le daltonisme).
 *
 * L'icône et la teinte viennent de tokens.json, donc du dossier de conception ;
 * le mot vient de l'application, qui seule connaît la langue du visiteur.
 */
const TEINTES: Record<string, string> = {
  alerte: "bg-teinte-orange text-alerte",
  succes: "bg-teinte-vert text-succes",
  danger: "bg-teinte-rouge text-danger",
  "encre-douce": "bg-teinte-gris text-encre-douce",
};

export function BadgeStatut({
  statut,
  libelle,
  className,
}: {
  statut: Statut;
  /** Le libellé traduit, par exemple « Acceptée : à confirmer ». */
  libelle: string;
  className?: string;
}) {
  const { icone, couleur } = STATUTS[statut];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-petit font-semibold",
        TEINTES[couleur],
        className,
      )}
    >
      <Icone nom={icone as NomIcone} taille={16} />
      {libelle}
    </span>
  );
}
