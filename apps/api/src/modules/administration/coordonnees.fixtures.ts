import { Injectable } from "@nestjs/common";
import type { Demande, FamilleCoordonnees } from "@teranga/contracts";

import { introuvable } from "../../commun/erreurs";
import { DepotDemandesFixtures, type TraceInterne } from "../demandes/demandes.fixtures";
import { conflitCoordonnees, type DepotCoordonnees, type LigneCoordonnees } from "./coordonnees.depot";

/**
 * Les coordonnées en mémoire, adossées au dépôt de démonstration des demandes.
 *
 * Elles partagent son stockage : la fin d'une demande — annulation,
 * expiration, refus — efface coordonnées et traçabilité au même endroit, comme
 * le fera la base.
 */
@Injectable()
export class DepotCoordonneesFixtures implements DepotCoordonnees {
  constructor(private readonly demandes: DepotDemandesFixtures) {}

  async lire(demandeId: string): Promise<LigneCoordonnees | null> {
    const interne = this.demandes.coordonneesInternes(demandeId);
    if (!interne) return null;
    const { demande, traces } = interne;
    return {
      demandeId: demande.id,
      statut: demande.statut,
      famille: familleDe(demande),
      coordonnees: demande.coordonnees,
      saisie: traces.saisie ? trace(traces.saisie) : undefined,
      verification: traces.verification ? trace(traces.verification) : undefined,
    };
  }

  async saisir(
    demandeId: string,
    entree: Parameters<DepotCoordonnees["saisir"]>[1],
  ): Promise<LigneCoordonnees> {
    if (!this.demandes.coordonneesInternes(demandeId)) throw introuvable("Demande");
    const ecrit = this.demandes.poserSaisieCoordonnees(demandeId, entree.statutLu, entree.coordonnees, {
      le: entree.le.toISOString(),
      parId: entree.parId,
    });
    if (!ecrit) throw conflitCoordonnees();
    return (await this.lire(demandeId))!;
  }

  async verifier(
    demandeId: string,
    entree: Parameters<DepotCoordonnees["verifier"]>[1],
  ): Promise<LigneCoordonnees> {
    if (!this.demandes.coordonneesInternes(demandeId)) throw introuvable("Demande");
    const ecrit = this.demandes.poserVerificationCoordonnees(demandeId, entree.statutLu, entree.saisieLe, {
      le: entree.le.toISOString(),
      parId: entree.parId,
    });
    if (!ecrit) throw conflitCoordonnees();
    return (await this.lire(demandeId))!;
  }
}

function familleDe(demande: Demande): FamilleCoordonnees | undefined {
  if (demande.offre.genre === "logement") return "logement";
  if (demande.offre.genre === "vehicule") return "vehicule";
  return undefined;
}

function trace(interne: TraceInterne) {
  return { le: interne.le, par: { id: interne.parId } };
}
