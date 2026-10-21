/**
 * La vitrine : les quatre logements mis en avant.
 *
 * Deux écrans montrent une sélection de quatre offres — la bande de la page
 * d'accueil et l'accueil du parcours logement (`/logements` sans critère).
 * Ils montraient des logements différents : l'un lisait cette liste, l'autre
 * prenait les quatre mieux notés du catalogue. Le visiteur qui cliquait
 * « voir tous les logements » tombait donc sur quatre autres maisons que
 * celles qu'il venait de regarder, sans que rien n'explique le changement.
 *
 * Une seule liste, lue aux deux endroits : changer la vitrine, c'est changer
 * cette ligne, et les deux écrans suivent.
 *
 * La sélection est choisie, pas calculée : ces quatre-là ont les photos qui
 * tiennent le mieux la vignette, et elles couvrent les quatre budgets et les
 * quatre formats que la plateforme propose — une villa familiale à Saly, une
 * villa à grande piscine à Nguérigne, un studio, une villa de cinq chambres à
 * Somone.
 */
export const MIS_EN_AVANT = ["l-009", "l-012", "l-019", "l-016"] as const;
