/**
 * Projection Web Mercator — le minimum pour poser des tuiles et des repères.
 *
 * Pas de bibliothèque : le registre npm est injoignable depuis cet environnement,
 * et ces quatre formules sont la totalité de ce dont une carte statique a besoin.
 * Le jour où MapLibre entre dans le projet, ce fichier disparaît.
 */
export const TAILLE_TUILE = 256;

/** Longitude → coordonnée X en tuiles, au zoom donné. */
export function xDeLongitude(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

/** Latitude → coordonnée Y en tuiles, au zoom donné. */
export function yDeLatitude(latitude: number, zoom: number): number {
  const rad = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

export interface Cadre {
  centre: { latitude: number; longitude: number };
  zoom: number;
}

/**
 * Cadre englobant un ensemble de points, avec une marge.
 * Sans points, on retombe sur Dakar : une carte vide centrée sur l'océan
 * n'apprendrait rien au visiteur.
 */
export function cadrePour(
  points: { latitude: number; longitude: number }[],
  largeur: number,
  hauteur: number,
): Cadre {
  if (points.length === 0) return { centre: { latitude: 14.7167, longitude: -17.4677 }, zoom: 11 };

  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const centre = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
  };

  if (points.length === 1) return { centre, zoom: 13 };

  // Le plus grand zoom auquel tout tient encore dans le cadre.
  for (let zoom = 16; zoom >= 3; zoom--) {
    const xs = lons.map((l) => xDeLongitude(l, zoom) * TAILLE_TUILE);
    const ys = lats.map((l) => yDeLatitude(l, zoom) * TAILLE_TUILE);
    const dx = Math.max(...xs) - Math.min(...xs);
    const dy = Math.max(...ys) - Math.min(...ys);
    if (dx < largeur * 0.78 && dy < hauteur * 0.78) return { centre, zoom };
  }
  return { centre, zoom: 3 };
}
