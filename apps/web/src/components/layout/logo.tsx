import Image from "next/image";

/**
 * Logo Teranga Way.
 *
 * Trois formes, parce qu'un logo ne se réduit pas en gardant tout :
 *   — `verrou`  : pictogramme + nom. C'est la forme de l'en-tête.
 *   — `complet` : verrou + signature « your journey, our welcome ».
 *                 Elle n'est lisible qu'en grand ; réservée au pied de page.
 *   — `marque`  : pictogramme seul, quand le nom est déjà écrit à côté.
 *
 * Deux variantes : `sombre` pour les fonds clairs, `clair` pour les fonds
 * sombres — sur bleu nuit, le bleu du logo disparaîtrait. La variante claire
 * ne redessine pas la marque, elle remplace la seule teinte qui pose problème.
 */
const FICHIERS = {
  verrou: { sombre: "/images/logo.png", clair: "/images/logo-clair.png", ratio: 775 / 160 },
  complet: {
    sombre: "/images/logo-complet.png",
    clair: "/images/logo-complet-clair.png",
    ratio: 775 / 205,
  },
  marque: {
    sombre: "/images/logo-marque.png",
    clair: "/images/logo-marque-clair.png",
    ratio: 171 / 205,
  },
} as const;

export function Logo({
  className,
  variante = "sombre",
  forme = "verrou",
  hauteur = 40,
  prioritaire = false,
}: {
  className?: string;
  variante?: "sombre" | "clair";
  forme?: "verrou" | "complet" | "marque";
  /** Hauteur affichée, en pixels. La largeur suit le rapport du fichier. */
  hauteur?: number;
  prioritaire?: boolean;
}) {
  const f = FICHIERS[forme];
  const largeur = Math.round(hauteur * f.ratio);

  return (
    <Image
      src={f[variante]}
      // Le nom est déjà dans l'image pour `verrou` et `complet` : l'alternative
      // le redit pour qui ne voit pas l'image, et rien de plus.
      alt="Teranga Way"
      width={largeur}
      height={hauteur}
      priority={prioritaire}
      className={className}
      style={{ height: hauteur, width: "auto" }}
    />
  );
}
