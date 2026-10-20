import type { Logement } from "@teranga/contracts";
import { TRADUCTIONS_LOGEMENTS, type LangueTraduite } from "./logements.traductions";

/**
 * Un logement dans la langue demandée.
 *
 * Le catalogue est écrit en français, et la traduction se pose dessus au
 * moment de la lecture : rien n'est dupliqué, et une traduction manquante
 * laisse le texte d'origine. Le reste du logement — prix, quartier, ville,
 * identifiants, adresses des photos — ne bouge pas : ce sont des données, pas
 * des phrases.
 *
 * `titre` fait exception et reste traduit à l'écran : il apparaît aussi sur
 * des demandes déjà enregistrées, que ce catalogue ne relit pas.
 */
export function traduireLogement(logement: Logement, langue: string): Logement {
  if (langue === "fr") return logement;

  const traduction = TRADUCTIONS_LOGEMENTS[langue as LangueTraduite]?.[logement.id];
  if (!traduction) return logement;

  return {
    ...logement,
    description: traduction.description ?? logement.description,
    regles: traduction.regles ?? logement.regles,
    photos: traduction.photos
      ? logement.photos.map((photo, i) =>
          traduction.photos![i] ? { ...photo, alt: traduction.photos![i] } : photo,
        )
      : logement.photos,
    videos: traduction.videos
      ? logement.videos?.map((video, i) =>
          traduction.videos![i] ? { ...video, legende: traduction.videos![i] } : video,
        )
      : logement.videos,
  };
}
