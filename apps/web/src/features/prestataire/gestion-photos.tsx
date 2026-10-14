"use client";

import { useEffect, useState } from "react";
import { Bandeau, Bouton, Icone } from "@teranga/ui";
import { useT } from "@/lib/i18n/contexte";
import { PHOTOS_MINIMUM } from "@/mocks/fixtures/prestataire";

interface PhotoLocale {
  url: string;
  nom: string;
}

/**
 * Gestion des photos.
 *
 * Il n'y a pas encore de stockage : les images restent dans le navigateur, et la
 * page le dit. Ce qui est réel et utile dès maintenant, c'est la règle — cinq
 * photos au minimum, une principale — et le décompte qui la rend visible.
 */
export function GestionPhotos({ existantes }: { existantes: { url: string; alt: string }[] }) {
  const t = useT();
  const [photos, setPhotos] = useState<PhotoLocale[]>(
    existantes.map((p) => ({ url: p.url, nom: p.alt })),
  );
  const [principale, setPrincipale] = useState(0);

  // Les URL d'objet se révoquent, sinon le navigateur garde les fichiers en mémoire.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.url.startsWith("blob:") && URL.revokeObjectURL(p.url));
    };
    // Au démontage seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouter = (fichiers: FileList | null) => {
    if (!fichiers) return;
    setPhotos((liste) => [
      ...liste,
      ...Array.from(fichiers).map((f) => ({ url: URL.createObjectURL(f), nom: f.name })),
    ]);
  };

  const retirer = (index: number) => {
    setPhotos((liste) => liste.filter((_, i) => i !== index));
    setPrincipale((p) => (index === p ? 0 : index < p ? p - 1 : p));
  };

  const assez = photos.length >= PHOTOS_MINIMUM;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-petit font-semibold ${assez ? "text-succes" : "text-alerte"}`}>
          {t("prestataire.photosCompte", { nombre: photos.length, minimum: PHOTOS_MINIMUM })}
        </p>

        <label className="inline-flex min-h-[var(--size-control)] cursor-pointer items-center gap-2 rounded-control border border-primaire bg-surface px-4 text-bouton text-primaire">
          <Icone nom="plus" taille={20} />
          {t("prestataire.photosAjouter")}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => ajouter(e.target.files)}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-card border border-contour bg-surface px-5 py-8 text-center text-corps text-encre-douce">
          {t("prestataire.photosAucune")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <li key={photo.url} className="overflow-hidden rounded-card border border-contour bg-surface">
              {/* Une image locale : `next/image` n'a rien à optimiser ici. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.nom} className="aspect-[4/3] w-full object-cover" />

              <div className="space-y-2 p-3">
                {i === principale ? (
                  <p className="inline-flex items-center gap-1 rounded-pill bg-teinte-bleu px-2.5 py-1 text-legende font-semibold text-primaire">
                    <Icone nom="coche-cercle" taille={16} />
                    {t("prestataire.photosPrincipale")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPrincipale(i)}
                    className="text-legende font-semibold text-primaire underline underline-offset-2"
                  >
                    {t("prestataire.photosDefinirPrincipale")}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => retirer(i)}
                  className="block text-legende text-danger underline underline-offset-2"
                >
                  {t("prestataire.photosSupprimer")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Bandeau variante="information">{t("prestataire.photosDemo")}</Bandeau>
    </div>
  );
}
