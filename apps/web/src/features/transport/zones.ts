/**
 * Les lieux desservis, avec une position approximative.
 *
 * Elles servent à une seule chose : rapprocher la position du téléphone du
 * lieu le plus proche parmi ceux que vos chauffeurs desservent. Pas de
 * géocodage inverse, donc pas de service tiers, pas de clé, pas de latence —
 * et surtout **aucune coordonnée ne quitte le navigateur**. Le serveur ne
 * reçoit qu'un nom de lieu, celui-là même qu'on aurait tapé à la main.
 *
 * La précision demandée est faible : les lieux sont distants de plusieurs
 * kilomètres, sauf les trois sites de Diamniadio, qui partagent une zone
 * commune — c'est pourquoi `zone` existe. On annonce la zone, pas le site : un
 * visiteur près du Dakar Arena n'est pas forcément au Dakar Arena.
 *
 * ⚠️ Coordonnées relevées au centre de quartier, à vérifier avant la mise en
 * ligne. Une erreur de un ou deux kilomètres est sans effet sur le
 * rapprochement — les lieux sont bien plus éloignés que ça les uns des autres
 * — mais elle se verrait dans la distance affichée.
 */
export interface LieuSitue {
  valeur: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** Les lieux d'une même zone sont indiscernables à l'échelle d'un GPS. */
  zone: string;
}

const POSITIONS: Record<string, { latitude: number; longitude: number; zone: string }> = {
  "Aéroport AIBD": { latitude: 14.6702, longitude: -17.0732, zone: "Diass" },
  "Stade Abdoulaye-Wade": { latitude: 14.7331, longitude: -17.1805, zone: "Diamniadio" },
  "Dakar Arena": { latitude: 14.7344, longitude: -17.1781, zone: "Diamniadio" },
  "Village olympique": { latitude: 14.7372, longitude: -17.1724, zone: "Diamniadio" },
  Plateau: { latitude: 14.6677, longitude: -17.4335, zone: "Dakar" },
  Almadies: { latitude: 14.7446, longitude: -17.5131, zone: "Dakar" },
  Ngor: { latitude: 14.7521, longitude: -17.5133, zone: "Dakar" },
  Mermoz: { latitude: 14.7096, longitude: -17.4702, zone: "Dakar" },
  Saly: { latitude: 14.4472, longitude: -17.0101, zone: "Mbour" },
};

/**
 * Enrichit une liste de lieux de leur position. Un lieu sans position est ignoré.
 *
 * La liste arrive en argument plutôt que d'être importée : ce module reste pur,
 * et le catalogue ne se lit qu'à un seul endroit — celui que `verifier-couture`
 * connaît déjà.
 */
export function situer(lieux: { valeur: string; detail: string }[]): LieuSitue[] {
  return lieux.flatMap((lieu) => {
    const position = POSITIONS[lieu.valeur];
    return position ? [{ ...lieu, ...position }] : [];
  });
}

const RAYON_TERRE_KM = 6371;

/** Distance à vol d'oiseau, en kilomètres (formule de haversine). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (degres: number) => (degres * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h));
}

export interface Rapprochement {
  lieu: LieuSitue;
  distanceKm: number;
  /** Au-delà, on propose le lieu sans affirmer qu'on y est. */
  certain: boolean;
}

/**
 * Le lieu desservi le plus proche d'une position.
 *
 * `certain` passe à faux au-delà de 15 km : à cette distance, le plus proche
 * n'est plus une réponse, c'est une supposition. L'écran doit alors le dire —
 * « Vous semblez être près de… » plutôt que « Vous êtes à… » — et laisser
 * corriger. Entre Dakar et Saly il y a 80 km : la nuance n'est pas théorique.
 */
export function lieuLePlusProche(
  position: { latitude: number; longitude: number },
  lieux: LieuSitue[],
): Rapprochement | null {
  if (lieux.length === 0) return null;

  let meilleur = lieux[0];
  let meilleure = distanceKm(position, meilleur);

  for (const lieu of lieux.slice(1)) {
    const d = distanceKm(position, lieu);
    if (d < meilleure) {
      meilleur = lieu;
      meilleure = d;
    }
  }

  return { lieu: meilleur, distanceKm: meilleure, certain: meilleure <= 15 };
}

/**
 * Les lieux qui correspondent à une saisie.
 *
 * La comparaison ignore la casse et les accents : « aeroport » doit trouver
 * « Aéroport AIBD », parce qu'un visiteur étranger tape rarement les accents.
 * Elle porte sur le nom **et** sur le détail, pour que « Diamniadio » ramène
 * les trois sites qui s'y trouvent alors qu'aucun ne porte ce nom.
 */
export function suggerer(saisie: string, lieux: LieuSitue[], maximum = 6): LieuSitue[] {
  const terme = normaliser(saisie);
  if (!terme) return lieux.slice(0, maximum);

  const commence: LieuSitue[] = [];
  const contient: LieuSitue[] = [];

  for (const lieu of lieux) {
    const nom = normaliser(lieu.valeur);
    const detail = normaliser(lieu.detail);
    if (nom.startsWith(terme)) commence.push(lieu);
    else if (nom.includes(terme) || detail.includes(terme)) contient.push(lieu);
  }

  // Ce qui commence par la saisie d'abord : c'est ce que la personne vise.
  return [...commence, ...contient].slice(0, maximum);
}

function normaliser(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
