import { Injectable } from "@nestjs/common";
import type { Demande } from "@teranga/contracts";
import { DEMANDES, LOGEMENTS, VEHICULES } from "@teranga/fixtures";

import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { expireLePour } from "./machine-a-etats/delais";
import type {
  DepotDemandes,
  EntreeCreationLogement,
  EntreeCreationService,
  EntreeCreationVehicule,
} from "./demandes.depot";

/**
 * Catalogue en mémoire, mutable pour le temps du processus.
 *
 * On clone le tableau fixtures : les mutations (confirmer, répondre…) restent
 * locales au serveur de développement, comme le faisait `mocks/api.ts`.
 */
@Injectable()
export class DepotDemandesFixtures implements DepotDemandes {
  private readonly demandes: Demande[] = structuredClone(DEMANDES);
  /** Rattachement démo : toutes les demandes fixtures appartiennent au visiteur de démo. */
  private readonly parVisiteur = new Map<string, string>(
    this.demandes.map((d) => [d.id, "visiteur-demo"]),
  );

  async listerPourVisiteur(visiteurId: string): Promise<Demande[]> {
    const ids = [...this.parVisiteur.entries()]
      .filter(([, v]) => v === visiteurId)
      .map(([id]) => id);
    return this.demandes.filter((d) => ids.includes(d.id));
  }

  async parId(id: string): Promise<Demande | null> {
    return this.demandes.find((d) => d.id === id) ?? null;
  }

  async creerLogement(entree: EntreeCreationLogement): Promise<Demande> {
    const logement = LOGEMENTS.find((l) => l.id === entree.logementId);
    if (!logement) throw introuvable("Logement");

    const jour = 24 * 60 * 60 * 1000;
    const nuits = Math.max(
      1,
      Math.round(
        (new Date(entree.fin).getTime() - new Date(entree.debut).getTime()) / jour,
      ),
    );
    if (Number.isNaN(nuits) || new Date(entree.fin) <= new Date(entree.debut)) {
      throw new ErreurMetier("DATES_INVALIDES", "Les dates de séjour sont invalides.");
    }
    if (entree.personnes > logement.capacite) {
      throw new ErreurMetier(
        "CAPACITE_DEPASSEE",
        "Ce logement ne peut pas accueillir autant de personnes.",
      );
    }

    const fraisFixes = logement.fraisFixes ?? [];
    const total =
      logement.prixParNuit * nuits + fraisFixes.reduce((s, f) => s + f.montant, 0);
    const maintenant = new Date().toISOString();

    const demande: Demande = {
      id: `d-${Date.now()}`,
      reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
      statut: "envoyee",
      offre: {
        genre: "logement",
        logementId: logement.id,
        titre: logement.titre,
        vignette: logement.photos[0].url,
      },
      dates: { debut: entree.debut, fin: entree.fin },
      personnes: entree.personnes,
      heureArrivee: entree.heureArrivee,
      message: entree.message,
      prix: { prixParNuit: logement.prixParNuit, nuits, fraisFixes, total },
      frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
      expireLe: expireLePour("logement"),
    };

    this.demandes.unshift(demande);
    this.parVisiteur.set(demande.id, entree.visiteurId);
    return structuredClone(demande);
  }

  async creerVehicule(entree: EntreeCreationVehicule): Promise<Demande> {
    const vehicule = VEHICULES.find((v) => v.id === entree.vehiculeId);
    if (!vehicule) throw introuvable("Vehicule");

    const genre =
      entree.prestation === "journee"
        ? "location"
        : entree.prestation === "taxi"
          ? "taxi"
          : "trajet";

    const total =
      entree.prestation === "journee"
        ? (vehicule.prixParJour ?? vehicule.prixParTrajet ?? 0)
        : (vehicule.prixParTrajet ?? vehicule.prixParJour ?? 0);

    const maintenant = new Date().toISOString();
    const demande: Demande = {
      id: `d-${Date.now()}`,
      reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
      statut: "envoyee",
      offre: {
        genre: "vehicule",
        vehiculeId: vehicule.id,
        titre: `${vehicule.marque} ${vehicule.modele}`,
        vignette: vehicule.photos[0].url,
      },
      dates: { debut: entree.quand, fin: entree.quand },
      personnes: entree.passagers,
      message: entree.message,
      prix: { prixParNuit: total, nuits: 1, fraisFixes: [], total },
      frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
      expireLe: expireLePour(genre),
    };

    this.demandes.unshift(demande);
    this.parVisiteur.set(demande.id, entree.visiteurId);
    return structuredClone(demande);
  }

  async creerService(entree: EntreeCreationService): Promise<Demande> {
    const maintenant = new Date().toISOString();
    const demande: Demande = {
      id: `d-${Date.now()}`,
      reference: `TW-${Math.floor(100000 + Math.random() * 900000)}`,
      statut: "envoyee",
      offre: {
        genre: "service",
        service: entree.service,
        titre: entree.service,
        details: entree.details,
      },
      // Un service n'a pas forcément de période : la date demandée tient lieu
      // des deux bornes, et reste vide quand le formulaire n'en demande pas.
      dates: { debut: entree.details.date ?? "", fin: entree.details.date ?? "" },
      personnes: Number(entree.details.personnes ?? entree.details.lignes ?? 1) || 1,
      message: entree.message,
      prix: { total: 0 },
      frise: [{ statut: "envoyee", horodatage: maintenant, origine: "visiteur" }],
    };

    this.demandes.unshift(demande);
    this.parVisiteur.set(demande.id, entree.visiteurId);
    return structuredClone(demande);
  }

  async enregistrer(demande: Demande): Promise<Demande> {
    const index = this.demandes.findIndex((d) => d.id === demande.id);
    if (index < 0) throw introuvable("Demande");
    this.demandes[index] = structuredClone(demande);
    return structuredClone(demande);
  }

  /** Réservé aux réponses partenaire : rattachement interne. */
  visiteurDe(demandeId: string): string | undefined {
    return this.parVisiteur.get(demandeId);
  }
}
