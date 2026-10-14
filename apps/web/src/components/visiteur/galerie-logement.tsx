"use client";

import Image from "next/image";
import { Galerie, type PhotoGalerie } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";

/**
 * Enveloppe applicative de la galerie.
 *
 * `Galerie` prend une fonction de rendu, qui ne traverse pas la frontière
 * serveur/client : c'est donc ici, dans un composant client, qu'on lui donne son
 * `next/image` et ses libellés traduits.
 *
 * Format 16:9 en tête de fiche, comme le demande le §A.7.
 */
export function GalerieLogement({ photos }: { photos: PhotoGalerie[] }) {
  const t = useT();

  return (
    <Galerie
      photos={photos}
      etiquette={t("fiche.galerie")}
      etiquetteCompteur={(index, total) =>
        t("fiche.galerieCompteur", { index, total })
      }
      etiquettePrecedente={t("fiche.photoPrecedente")}
      etiquetteSuivante={t("fiche.photoSuivante")}
      etiquettePleinEcran={t("fiche.voirPleinEcran")}
      etiquetteFermer={t("fiche.fermer")}
      className="overflow-hidden rounded-card bg-champ"
      rendreImage={(photo, i) => (
        <span className="relative block aspect-[16/9] w-full">
          <Image
            src={photo.url}
            alt={photo.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
        </span>
      )}
    />
  );
}
