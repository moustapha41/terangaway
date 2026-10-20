import { totalSejour, type Demande, type EtapeFrise, type StatutDemande } from "@teranga/contracts";
import { LOGEMENTS } from "./logements";
import { VEHICULES } from "./vehicules";

/**
 * Une demande par statut : les sept écrans de l'écran 6 se regardent sans
 * attendre qu'un partenaire réponde.
 *
 * `coordonnees` n'est rempli que sur la demande confirmée. C'est la règle du
 * §D.4 : avant la confirmation, le serveur n'envoie ni adresse ni téléphone.
 */
const JOUR = 24 * 60 * 60 * 1000;
const il_y_a = (heures: number) => new Date(Date.now() - heures * 60 * 60 * 1000).toISOString();

function prixDe(logementId: string, nuits: number) {
  const logement = LOGEMENTS.find((l) => l.id === logementId)!;
  const fraisFixes = logement.fraisFixes ?? [];
  return {
    prixParNuit: logement.prixParNuit,
    nuits,
    fraisFixes,
    total: totalSejour(logement, nuits, fraisFixes),
  };
}

function offreDe(logementId: string) {
  const logement = LOGEMENTS.find((l) => l.id === logementId)!;
  return {
    genre: "logement" as const,
    logementId: logement.id,
    titre: logement.titre,
    vignette: logement.photos[0].url,
  };
}

interface Gabarit {
  id: string;
  reference: string;
  statut: StatutDemande;
  logementId: string;
  nuits: number;
  heuresEcoulees: number;
}

const GABARITS: Gabarit[] = [
  { id: "d-001", reference: "TW-480213", statut: "acceptee", logementId: "l-002", nuits: 5, heuresEcoulees: 3 },
  { id: "d-002", reference: "TW-480198", statut: "envoyee", logementId: "l-004", nuits: 14, heuresEcoulees: 1 },
  { id: "d-003", reference: "TW-479044", statut: "confirmee", logementId: "l-001", nuits: 4, heuresEcoulees: 30 },
  { id: "d-004", reference: "TW-478510", statut: "refusee", logementId: "l-003", nuits: 7, heuresEcoulees: 52 },
  { id: "d-005", reference: "TW-477221", statut: "expiree", logementId: "l-005", nuits: 3, heuresEcoulees: 96 },
  { id: "d-006", reference: "TW-476003", statut: "terminee", logementId: "l-007", nuits: 6, heuresEcoulees: 400 },
  { id: "d-007", reference: "TW-475888", statut: "annulee", logementId: "l-006", nuits: 2, heuresEcoulees: 420 },
  // Seconde demande en attente, pour que chaque jeton de démonstration ait la sienne.
  { id: "d-008", reference: "TW-480245", statut: "envoyee", logementId: "l-008", nuits: 4, heuresEcoulees: 1 },
];

/** La frise ne garde que les étapes réellement franchies, dans l'ordre. */
function friseDe(statut: StatutDemande, depuis: number): EtapeFrise[] {
  // Le type est posé sur le tableau : sans lui, TypeScript le fige sur la forme
  // du premier élément et refuse les étapes suivantes.
  const etapes: EtapeFrise[] = [
    { statut: "envoyee", horodatage: il_y_a(depuis), origine: "visiteur" },
  ];
  if (["acceptee", "confirmee", "terminee"].includes(statut)) {
    etapes.push({ statut: "acceptee", horodatage: il_y_a(depuis - 1), origine: "partenaire" });
  }
  if (["confirmee", "terminee"].includes(statut)) {
    etapes.push({ statut: "confirmee", horodatage: il_y_a(depuis - 2), origine: "visiteur" });
  }
  if (statut === "terminee") {
    etapes.push({ statut: "terminee", horodatage: il_y_a(depuis - 300), origine: "systeme" });
  }
  if (statut === "refusee") {
    etapes.push({ statut: "refusee", horodatage: il_y_a(depuis - 2), origine: "partenaire" });
  }
  if (statut === "expiree") {
    etapes.push({ statut: "expiree", horodatage: il_y_a(depuis - 2), origine: "systeme" });
  }
  if (statut === "annulee") {
    etapes.push({ statut: "annulee", horodatage: il_y_a(depuis - 4), origine: "visiteur" });
  }
  return etapes;
}

/**
 * Réservations de transport.
 *
 * L'espace client mélange logement et transport dans une même liste : c'est le
 * séjour qui compte pour le visiteur, pas la nature du prestataire.
 */
interface GabaritTransport {
  id: string;
  reference: string;
  statut: StatutDemande;
  vehiculeId: string;
  titre: string;
  total: number;
  dansJours: number;
  heure: string;
  passagers: number;
}

const TRANSPORTS: GabaritTransport[] = [
  {
    id: "d-101", reference: "TW-480310", statut: "envoyee", vehiculeId: "v-002",
    titre: "Transfert aéroport", total: 25000, dansJours: 20, heure: "10:00", passagers: 2,
  },
  {
    id: "d-102", reference: "TW-479550", statut: "annulee", vehiculeId: "v-001",
    titre: "Location avec chauffeur", total: 70000, dansJours: 23, heure: "09:00", passagers: 3,
  },
];

const DEMANDES_TRANSPORT: Demande[] = TRANSPORTS.map((g): Demande => {
  const vehicule = VEHICULES.find((v) => v.id === g.vehiculeId)!;
  const quand = new Date(Date.now() + g.dansJours * JOUR);
  return {
    id: g.id,
    reference: g.reference,
    statut: g.statut,
    offre: {
      genre: "vehicule" as const,
      vehiculeId: vehicule.id,
      titre: g.titre,
      vignette: vehicule.photos[0].url,
    },
    dates: { debut: quand.toISOString(), fin: quand.toISOString() },
    personnes: g.passagers,
    heureArrivee: g.heure,
    prix: { total: g.total },
    frise: friseDe(g.statut, 6),
    expireLe: g.statut === "envoyee" ? new Date(Date.now() + 45 * 60000).toISOString() : undefined,
  };
});

export const DEMANDES: Demande[] = GABARITS.map((g): Demande => {
  const debut = new Date(Date.now() + 20 * JOUR);
  const fin = new Date(debut.getTime() + g.nuits * JOUR);

  return {
    id: g.id,
    reference: g.reference,
    statut: g.statut,
    offre: offreDe(g.logementId),
    dates: { debut: debut.toISOString(), fin: fin.toISOString() },
    personnes: 2,
    heureArrivee: "18:00",
    prix: prixDe(g.logementId, g.nuits),
    frise: friseDe(g.statut, g.heuresEcoulees),
    expireLe:
      g.statut === "envoyee" ? new Date(Date.now() + 90 * 60 * 1000).toISOString() : undefined,
    motifRefus: g.statut === "refusee" ? "plus-disponible" : undefined,
    // Révélées uniquement après confirmation.
    coordonnees:
      g.statut === "confirmee" || g.statut === "terminee"
        ? {
            adresseExacte: "12, route de la Corniche Ouest, Fann, Dakar",
            telephone: "+221 77 123 45 67",
            consignesArrivee: "Sonnez à l'interphone « Résidence », deuxième étage à droite.",
          }
        : undefined,
  };
}).concat(DEMANDES_TRANSPORT);
