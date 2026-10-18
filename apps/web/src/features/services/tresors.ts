export type CategorieTresor = "memoire" | "nature" | "culture" | "spiritualite";

export interface Tresor {
  /** Préfixe des clés de catalogue : `guides.tresor.<cle>.nom`, `.histoire`… */
  cle: string;
  categorie: CategorieTresor;
  latitude: number;
  longitude: number;
  /** Année d'inscription au patrimoine mondial, pour les sites qui le sont. */
  unesco?: number;
}

/**
 * Les sites que l'on fait découvrir, et où ils se trouvent.
 *
 * Seules les données qui ne se traduisent pas vivent ici : la catégorie, la
 * position et l'année d'inscription à l'UNESCO. Le nom, l'histoire, l'accès et
 * le conseil pratique sont au catalogue de langues — un site n'a pas le même
 * nom en espagnol qu'en français, et son histoire se raconte dans la langue du
 * visiteur.
 *
 * Les positions sont celles du site, au village ou à l'entrée du parc près.
 * Elles servent à situer sur la carte, pas à guider un véhicule.
 *
 * L'ordre est géographique : Dakar et sa presqu'île d'abord, puis la petite
 * côte, le delta, le nord, et enfin l'est et le sud — c'est l'ordre dans lequel
 * un séjour se construit, du plus accessible au plus lointain.
 */
export const TRESORS: readonly Tresor[] = [
  { cle: "goree", categorie: "memoire", latitude: 14.6672, longitude: -17.3986, unesco: 1978 },
  { cle: "renaissance", categorie: "culture", latitude: 14.7206, longitude: -17.4906 },
  { cle: "civilisations", categorie: "culture", latitude: 14.6703, longitude: -17.4336 },
  { cle: "lacRose", categorie: "nature", latitude: 14.8389, longitude: -17.2353 },
  { cle: "bandia", categorie: "nature", latitude: 14.5667, longitude: -17.0167 },
  { cle: "saloum", categorie: "nature", latitude: 13.95, longitude: -16.65, unesco: 2011 },
  { cle: "lompoul", categorie: "nature", latitude: 15.45, longitude: -16.9167 },
  { cle: "saintLouis", categorie: "memoire", latitude: 16.0179, longitude: -16.4896, unesco: 2000 },
  { cle: "djoudj", categorie: "nature", latitude: 16.3833, longitude: -16.25, unesco: 1981 },
  { cle: "touba", categorie: "spiritualite", latitude: 14.85, longitude: -15.8833 },
  { cle: "niokolo", categorie: "nature", latitude: 13.05, longitude: -13.0, unesco: 1981 },
  { cle: "casamance", categorie: "culture", latitude: 12.3833, longitude: -16.75 },
];

export const CATEGORIES_TRESOR: readonly CategorieTresor[] = [
  "memoire",
  "nature",
  "culture",
  "spiritualite",
];

/** Les prestations d'un guide, dans l'ordre où on les propose. */
export const PRESTATIONS_GUIDE = [
  "accompagnement",
  "interpretariat",
  "visiteGuidee",
  "surMesure",
] as const;
