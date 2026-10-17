import { Module } from "@nestjs/common";

import { ModuleComptes } from "../comptes/comptes.module";
import { ModuleDemandes } from "../demandes/demandes.module";
import { ControleurAdministration } from "./administration.controller";
import { DEPOT_ADMINISTRATION } from "./administration.depot";
import { DepotAdministrationPrisma } from "./administration.prisma";
import { ServiceAdministration } from "./administration.service";

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
  ],
  exports: [ServiceAdministration],
})
export class ModuleAdministration {}
