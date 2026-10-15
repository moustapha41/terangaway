import { Bandeau } from "@teranga/ui";
import { catalogueDeDemonstration } from "@/features/catalogue/demonstration";
import type { Traducteur } from "@/lib/i18n/traducteur";

/**
 * Dit que l'offre affichée est un exemple, là où ça compte.
 *
 * Les fiches portent un badge « Vérifié », un prix à la nuit et un bouton pour
 * réserver. Tout y ressemble à une offre réelle, et rien n'indiquait que le
 * catalogue est un jeu d'exemples. Le bandeau comble exactement cet écart : il
 * n'enlève rien à l'écran, il dit ce que l'écran laissait croire.
 *
 * Variante « avertissement » plutôt qu'« information » : ce n'est pas un détail
 * de contexte, c'est une réserve sur ce qu'on regarde.
 *
 * Il ne s'affiche pas quand le catalogue n'est plus de démonstration ; le
 * composant disparaît alors des pages sans les modifier.
 */
export function BandeauCatalogueDemo({
  t,
  className,
}: {
  t: Traducteur;
  className?: string;
}) {
  if (!catalogueDeDemonstration()) return null;

  return (
    <Bandeau variante="avertissement" className={className}>
      <strong className="block font-semibold">{t("catalogue.demoTitre")}</strong>
      {t("catalogue.demoTexte")}
    </Bandeau>
  );
}
