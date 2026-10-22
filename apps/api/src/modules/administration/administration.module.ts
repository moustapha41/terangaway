import { Module } from "@nestjs/common";

import { ModuleComptes } from "../comptes/comptes.module";
import { ModuleDemandes } from "../demandes/demandes.module";
import { ControleurAdministration } from "./administration.controller";
import { DEPOT_ADMINISTRATION } from "./administration.depot";
import { DepotAdministrationPrisma } from "./administration.prisma";
import { ServiceAdministration } from "./administration.service";
import { DEPOT_COORDONNEES } from "../../commun/depots/depot";
import { DepotCoordonneesPrisma } from "./coordonnees.prisma";
import { ServiceCoordonnees } from "./coordonnees.service";

/**
 * Module « administration » — le backoffice de l'équipe.
 *
 * Il réutilise `ModuleDemandes` plutôt que d'écrire ses propres changements de
 * statut : la table des transitions et la frise n'existent qu'à un endroit,
 * et le backoffice n'y échappe pas.
 */
@Module({
  imports: [ModuleComptes, ModuleDemandes],
  controllers: [ControleurAdministration],
  providers: [
    ServiceAdministration,
    { provide: DEPOT_ADMINISTRATION, useClass: DepotAdministrationPrisma },
    ServiceCoordonnees,
    // En attente de migration : chaque opération répond 503, explicitement.
    { provide: DEPOT_COORDONNEES, useClass: DepotCoordonneesPrisma },
  ],
  exports: [ServiceAdministration],
})
export class ModuleAdministration {}
