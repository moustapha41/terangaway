import type { Avis } from "@teranga/contracts";

/**
 * Avis de démonstration.
 *
 * Trois par logement : assez pour que l'onglet ait du contenu et que la moyenne
 * ait un sens, assez peu pour qu'on voie tout de suite que ce sont des exemples.
 * Les auteurs sont réduits au prénom et à l'initiale, comme les partenaires.
 */
const TEXTES: [string, number, string][] = [
  ["Awa D.", 5, "Accueil impeccable et logement conforme aux photos. Le quartier est calme et bien desservi."],
  ["Jean-Marc P.", 4, "Très bon séjour. Climatisation efficace, propreté irréprochable. Un peu loin des sites."],
  ["Nadia B.", 5, "Hôte très disponible, tout était prêt à notre arrivée. Nous reviendrons."],
  ["Thomas L.", 4, "Bon rapport qualité-prix. L'accès est facile en voiture, moins à pied."],
  ["Seynabou F.", 5, "Logement spacieux et lumineux, parfait pour une famille. Rien à redire."],
  ["Carlos M.", 4, "Conforme à la description. Le petit-déjeuner compris est un vrai plus."],
];

const JOUR = 24 * 60 * 60 * 1000;

/** Les avis d'un logement, dérivés de son identifiant pour rester stables. */
export function avisDe(logementId: string, nombre: number): Avis[] {
  const graine = Number(logementId.replace(/\D/g, "")) || 1;
  return Array.from({ length: Math.min(3, Math.max(0, nombre)) }, (_, i) => {
    const [auteur, note, texte] = TEXTES[(graine + i) % TEXTES.length];
    return {
      id: `${logementId}-a${i}`,
      auteur,
      note,
      // Dates figées par rapport au catalogue, pas à l'horloge : un avis ne doit
      // pas changer de date à chaque rendu.
      date: new Date(Date.UTC(2026, 8, 1) + (graine * 3 + i * 11) * JOUR).toISOString(),
      texte,
    };
  });
}
