import { Injectable } from "@nestjs/common";
import { totalSejour, type ChoixTransfert, type Demande, type StatutDemande } from "@teranga/contracts";
import { DEMANDES, LOGEMENTS, VEHICULES } from "@teranga/fixtures";

import { ErreurMetier, introuvable } from "../../commun/erreurs";
import { expireLePour, type GenreService } from "./machine-a-etats/delais";
import type {
  DepotDemandes,
  EntreeCreationLogement,
  EntreeCreationService,
  EntreeCreationVehicule,
} from "./demandes.depot";
import { transitionConcurrente, type ResultatTransfert } from "./demandes.depot";
import { coordonneesAEffacer, coordonneesDivulguables } from "./coordonnees";

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

  /** Le genre fin de chaque demande créée ici, comme la colonne `genre` de la base. */
  private readonly genres = new Map<string, GenreService>();

  async genreDe(demandeId: string): Promise<GenreService | undefined> {
    return this.genres.get(demandeId);
  }

  async listerPourVisiteur(visiteurId: string): Promise<Demande[]> {
    const ids = [...this.parVisiteur.entries()]
      .filter(([, v]) => v === visiteurId)
      .map(([id]) => id);
    return this.demandes.filter((d) => ids.includes(d.id)).map((d) => vue(d, this.verifiee(d.id)));
  }

  async parId(id: string): Promise<Demande | null> {
    const demande = this.demandes.find((d) => d.id === id);
    return demande ? vue(demande, this.verifiee(id)) : null;
  }

  /**
   * Qui a saisi et vérifié les coordonnées de chaque demande — l'équivalent
   * des quatre colonnes de traçabilité, en mémoire.
   */
  private readonly traces = new Map<string, TracesCoordonnees>();

  private verifiee(id: string): boolean {
    return this.traces.get(id)?.verification !== undefined;
  }

  /** Lecture brute, pour le dépôt des coordonnées : sans filtre de divulgation. */
  coordonneesInternes(id: string): { demande: Demande; traces: TracesCoordonnees } | null {
    const demande = this.demandes.find((d) => d.id === id);
    if (!demande) return null;
    return { demande: structuredClone(demande), traces: structuredClone(this.traces.get(id) ?? {}) };
  }

  /**
   * Pose une saisie et annule la vérification précédente — si le statut est
   * encore `statutLu`. `false` sinon : rien n'est écrit.
   */
  poserSaisieCoordonnees(
    id: string,
    statutLu: StatutDemande,
    coordonnees: NonNullable<Demande["coordonnees"]>,
    saisie: TraceInterne,
  ): boolean {
    const demande = this.demandes.find((d) => d.id === id);
    if (!demande || demande.statut !== statutLu) return false;
    demande.coordonnees = structuredClone(coordonnees);
    this.traces.set(id, { saisie: { ...saisie } });
    return true;
  }

  /**
   * Pose la vérification de **la** saisie lue — mêmes conditions que la
   * future écriture SQL : statut inchangé, saisie inchangée, coordonnées
   * présentes, pas encore vérifiée, et vérificateur différent du saisissant.
   */
  poserVerificationCoordonnees(
    id: string,
    statutLu: StatutDemande,
    saisieLe: string,
    verification: TraceInterne,
  ): boolean {
    const demande = this.demandes.find((d) => d.id === id);
    const traces = this.traces.get(id);
    if (
      !demande ||
      demande.statut !== statutLu ||
      !demande.coordonnees ||
      !traces?.saisie ||
      traces.saisie.le !== saisieLe ||
      traces.saisie.parId === verification.parId ||
      traces.verification
    ) {
      return false;
    }
    traces.verification = { ...verification };
    return true;
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
      totalSejour(logement, nuits, fraisFixes);
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
    this.genres.set(demande.id, "logement");
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
    this.genres.set(demande.id, genre);
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
    this.genres.set(demande.id, "service");
    return structuredClone(demande);
  }

  async enregistrer(demande: Demande, statutLu: StatutDemande): Promise<Demande> {
    const index = this.demandes.findIndex((d) => d.id === demande.id);
    if (index < 0) throw introuvable("Demande");
    const actuel = this.demandes[index].statut;
    if (actuel !== statutLu) throw transitionConcurrente(demande.id, statutLu, actuel);

    // Même règle que le dépôt Prisma : une transition n'écrit les coordonnées
    // que pour les effacer. Sinon, celles déjà rangées sont gardées — l'objet
    // reçu a été lu à travers le filtre, il ne les porte pas forcément.
    const efface = coordonneesAEffacer(demande.statut);
    const coordonnees = efface ? undefined : this.demandes[index].coordonnees;
    // Effacer les coordonnées remet leur traçabilité à zéro.
    if (efface) this.traces.delete(demande.id);
    this.demandes[index] = structuredClone({ ...demande, coordonnees });
    return vue(this.demandes[index], this.verifiee(demande.id));
  }

  /**
   * Même contrat que le dépôt Prisma : l'ancien choix est rendu, le nouveau est
   * posé, et rien n'est réécrit quand il est identique. En mémoire il n'y a pas
   * de compte à interroger — le contact reste vide.
   */
  async enregistrerTransfert(
    demandeId: string,
    choix: ChoixTransfert,
  ): Promise<ResultatTransfert | null> {
    const index = this.demandes.findIndex((d) => d.id === demandeId);
    if (index < 0) return null;

    const avant = this.demandes[index].transfert;
    if (avant !== choix) this.demandes[index] = { ...this.demandes[index], transfert: choix };

    return {
      demande: vue(this.demandes[index], this.verifiee(demandeId)),
      avant,
      contact: {},
    };
  }

  /** Réservé aux réponses partenaire : rattachement interne. */
  visiteurDe(demandeId: string): string | undefined {
    return this.parVisiteur.get(demandeId);
  }
}

export interface TraceInterne {
  le: string;
  parId: string;
}

export interface TracesCoordonnees {
  saisie?: TraceInterne;
  verification?: TraceInterne;
}

/**
 * Ce qu'une lecture rend : une copie, sans les coordonnées hors des statuts qui
 * les autorisent ou tant qu'elles ne sont pas vérifiées — la même règle que
 * `demandToDemande`.
 */
function vue(demande: Demande, verifiee: boolean): Demande {
  const copie = structuredClone(demande);
  if (!coordonneesDivulguables(copie.statut, verifiee)) copie.coordonnees = undefined;
  return copie;
}
