import { ArrowLeft } from "lucide-react";
import { Lien } from "@/lib/i18n/lien";
import { traducteurPour } from "@/lib/i18n/messages";
import type { Langue } from "@/lib/i18n/langues";

/**
 * Sortie de secours des écrans plein cadre.
 *
 * Connexion et inscription n'ont ni en-tête ni pied de page : une fois dessus,
 * le seul chemin de retour était le logo — cliquable, mais rien ne le disait.
 * Celui qui s'était trompé de porte n'avait plus que le bouton « précédent » du
 * navigateur, et aucun si la page avait été ouverte directement.
 *
 * La pastille reprend la forme du sélecteur de langue, qui lui fait face sur
 * l'écran de connexion : même hauteur, même fond, même ombre.
 */
export function RetourAccueil({
  langue,
  className,
}: {
  langue: Langue;
  className?: string;
}) {
  const t = traducteurPour(langue);

  return (
    <Lien
      href="/"
      className={
        "inline-flex min-h-[var(--size-touch)] items-center gap-2 rounded-pill bg-surface/95 " +
        "px-4 py-1.5 text-[14px] font-medium text-nuit shadow-[0_8px_24px_-12px_rgb(2_20_38/0.45)] " +
        "backdrop-blur-sm transition-colors hover:bg-surface " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire " +
        (className ?? "")
      }
    >
      <ArrowLeft strokeWidth={2} className="h-[17px] w-[17px] shrink-0" />
      {t("navigation.retourAccueil")}
    </Lien>
  );
}
