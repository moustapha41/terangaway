import { cn } from "../cn";
import { Icone } from "../icones";

/**
 * Badge « vérifié » — un seul visuel, jamais décliné (§C.3).
 *
 * Bleu nuit sur bleu clair, **jamais vert** : il parle de confiance, pas d'un
 * statut (§A.4). Rien ne s'affiche sans avoir été vérifié (cahier des charges) ;
 * ce badge est donc une information, pas une distinction entre les offres.
 */
export function BadgeVerifie({
  libelle,
  className,
}: {
  /** Le mot « Vérifié », traduit par l'application : @teranga/ui ne connaît pas les langues. */
  libelle: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-teinte-bleu px-2.5 py-1",
        "text-petit font-semibold text-primaire",
        className,
      )}
    >
      <Icone nom="verification" taille={16} />
      {libelle}
    </span>
  );
}
