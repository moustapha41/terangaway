import type { MotifRefus, ServiceALaDemande, StatutDemande } from "../enums";
import type { CoordonneesLogement, PrixSejour } from "./logement";
import type { CoordonneesVehicule } from "./vehicule";

export interface EtapeFrise {
  statut: StatutDemande;
  horodatage: string;
  /** Qui a provoqué l'étape : utile au support, jamais affiché tel quel. */
  origine: "visiteur" | "partenaire" | "equipe" | "systeme";
}

/**
 * Une demande. Pour logement et transport, le prix est figé à l'envoi (§B.2).
 * Pour un service à la demande, le total vaut 0 (= sur devis) : l'équipe
 * rappelle avec une proposition.
 *
 * `coordonnees` n'est présent qu'au statut « confirmée » : c'est le type qui
 * porte la règle, pas une condition dans un écran.
 */
export interface Demande {
  id: string;
  reference: string;
  statut: StatutDemande;
  offre:
    | { genre: "logement"; logementId: string; titre: string; vignette: string }
    | { genre: "vehicule"; vehiculeId: string; titre: string; vignette: string }
    /**
     * Service à la demande (V2) : restauration, visites, guides, billetterie.
     *
     * Pas d'identifiant d'offre — il n'y a pas de catalogue à pointer. Le
     * `titre` se compose de ce que le visiteur a décrit, et `details` garde sa
     * saisie telle quelle, pour que l'équipe sache quoi chercher.
     */
    | {
        genre: "service";
        service: ServiceALaDemande;
        titre: string;
        vignette?: string;
        details: Record<string, string>;
      };
  dates: { debut: string; fin: string };
  personnes: number;
  heureArrivee?: string;
  message?: string;
  prix: PrixSejour | { total: number };
  frise: EtapeFrise[];
  /** Au-delà, la demande passe « expirée ». */
  expireLe?: string;
  motifRefus?: MotifRefus;
  coordonnees?: CoordonneesLogement | CoordonneesVehicule;
}
