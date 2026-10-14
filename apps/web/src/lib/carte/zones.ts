/**
 * Centres approximatifs des zones desservies par les transports.
 *
 * Un véhicule n'a pas d'adresse : il circule. Le contrat `Vehicule` ne porte
 * donc aucune position — contrairement au logement, qui a un quartier fixe.
 * La carte des transports montre les **zones desservies**, pas des véhicules
 * posés quelque part, et chaque repère porte le prix le plus bas qu'on y trouve.
 *
 * Ces points sont volontairement grossiers : des centres de ville ou de pôle,
 * jamais le lieu de prise en charge d'un prestataire, qui ne doit pas être
 * public avant confirmation (§D.4).
 */
export const CENTRES_ZONES: Record<string, { latitude: number; longitude: number }> = {
  Dakar: { latitude: 14.7167, longitude: -17.4677 },
  Diamniadio: { latitude: 14.7206, longitude: -17.1844 },
  Saly: { latitude: 14.4461, longitude: -17.0106 },
  Thiès: { latitude: 14.7886, longitude: -16.9246 },
  "Aéroport AIBD": { latitude: 14.6702, longitude: -17.0733 },
};
