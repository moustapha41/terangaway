import { Inject, Injectable } from "@nestjs/common";
import type {
  ContactAdmin,
  DemandeAdmin,
  FiltresDemandesAdmin,
  MiseAJourDemandeAdmin,
  PageDemandesAdmin,
  TableauDeBordAdmin,
} from "@teranga/contracts";

import { introuvable } from "../../commun/erreurs";
import { ServiceDemandes } from "../demandes/demandes.service";
import {
  DEPOT_ADMINISTRATION,
  type DepotAdministration,
} from "./administration.depot";

@Injectable()
export class ServiceAdministration {
  constructor(
    @Inject(DEPOT_ADMINISTRATION) private readonly depot: DepotAdministration,
    private readonly demandes: ServiceDemandes,
  ) {}

  lister(filtres: FiltresDemandesAdmin): Promise<PageDemandesAdmin> {
    return this.depot.lister(filtres);
  }

  async obtenir(id: string): Promise<DemandeAdmin> {
    const demande = await this.depot.parId(id);
    if (!demande) throw introuvable("Demande");
    return demande;
  }

  tableauDeBord(): Promise<TableauDeBordAdmin> {
    return this.depot.tableauDeBord();
  }

  listerPrestataires(): Promise<ContactAdmin[]> {
    return this.depot.listerPrestataires();
  }

  /**
   * Applique ce que l'équipe a changé, en une fois.
   *
   * Le statut passe par `ServiceDemandes`, qui tient la table des transitions
   * et pose la frise : le backoffice n'a pas le droit d'écrire un statut
   * directement, sinon la règle vivrait à deux endroits et l'un des deux
   * finirait par l'oublier. L'acteur est « equipe » — c'est ce que la frise
   * retiendra, et c'est ce que l'équipe doit pouvoir justifier.
   *
   * L'annotation est enregistrée **avant** la transition : si le passage de
   * statut est refusé, la note et le prix proposé restent écrits, et l'équipe
   * ne retape pas ce qu'elle venait de saisir.
   */
  async mettreAJour(id: string, maj: MiseAJourDemandeAdmin): Promise<DemandeAdmin> {
    await this.obtenir(id);

    const annote =
      maj.noteInterne !== undefined ||
      maj.prixPropose !== undefined ||
      maj.prestataireId !== undefined;

    if (annote) {
      await this.depot.annoter(id, {
        noteInterne: maj.noteInterne,
        prixPropose: maj.prixPropose,
        prestataireId: maj.prestataireId,
      });
    }

    if (maj.statut) {
      await this.demandes.transitionner(id, maj.statut, "equipe", {
        motifRefus: maj.motifRefus,
      });
    }

    return this.obtenir(id);
  }

  async exporterCsv(filtres: FiltresDemandesAdmin): Promise<string> {
    const demandes = await this.depot.exporter(filtres);
    return composerCsv(demandes);
  }
}

/** Les colonnes de l'export, dans l'ordre où l'équipe les lit. */
const COLONNES = [
  "reference",
  "statut",
  "genre",
  "service",
  "recue_le",
  "visiteur_nom",
  "visiteur_email",
  "visiteur_telephone",
  "offre",
  "debut",
  "fin",
  "personnes",
  "heure_arrivee",
  "depart",
  "arrivee",
  "bagages",
  "vol",
  "details",
  "message",
  "prix_total",
  "prix_propose",
  "prestataire",
  "note_interne",
] as const;

/**
 * L'export, en CSV lisible par un tableur francophone.
 *
 * Le point-virgule plutôt que la virgule, et le BOM UTF-8 en tête : sans eux,
 * Excel en français ouvre le fichier en une seule colonne et mange les
 * accents. C'est le détail qui décide si l'équipe se sert de l'export ou le
 * recopie à la main.
 */
export function composerCsv(demandes: DemandeAdmin[]): string {
  const lignes = [COLONNES.join(";")];

  for (const d of demandes) {
    const details = d.service
      ? Object.entries(d.service.details)
          .map(([cle, valeur]) => `${cle}=${valeur}`)
          .join(" | ")
      : "";

    lignes.push(
      [
        d.reference,
        d.statut,
        d.genre,
        d.service?.cle ?? "",
        d.creeLe,
        d.visiteur.nom ?? "",
        d.visiteur.email ?? "",
        d.visiteur.telephone ?? "",
        d.offre.titre,
        d.dates.debut,
        d.dates.fin,
        String(d.personnes),
        d.heureArrivee ?? "",
        d.transport?.depart ?? "",
        d.transport?.arrivee ?? "",
        d.transport?.bagages !== undefined ? String(d.transport.bagages) : "",
        d.transport?.vol ?? "",
        details,
        d.message ?? "",
        String(d.prix.total),
        d.prixPropose !== undefined ? String(d.prixPropose) : "",
        d.prestataire?.nom ?? d.prestataire?.id ?? "",
        d.noteInterne ?? "",
      ]
        .map(echapper)
        .join(";"),
    );
  }

  return `﻿${lignes.join("\r\n")}\r\n`;
}

/**
 * Une valeur de cellule, neutralisée.
 *
 * Les guillemets et les retours à la ligne sont échappés comme le veut le
 * format ; le préfixe sur `= + - @` l'est pour une autre raison : un message
 * de visiteur commençant par `=` devient une formule dès l'ouverture du
 * fichier. On ne fait pas exécuter du texte reçu de l'extérieur.
 */
function echapper(valeur: string): string {
  const neutre = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
  return `"${neutre.replace(/"/g, '""')}"`;
}
