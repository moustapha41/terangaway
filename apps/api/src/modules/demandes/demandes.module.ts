import { Module } from "@nestjs/common";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ModuleComptes } from "../comptes/comptes.module";
import { ModuleOffres } from "../offres/offres.module";
import { ControleurDemandes } from "./demandes.controller";
import { DepotDemandesPrisma } from "./demandes.prisma";
import { ServiceDemandes } from "./demandes.service";
import { VeilleurDemandes } from "./veilleur.service";

@Module({
  imports: [ModuleComptes, ModuleOffres],
  controllers: [ControleurDemandes],
  providers: [
    ServiceDemandes,
    VeilleurDemandes,
    { provide: DEPOT_DEMANDES, useClass: DepotDemandesPrisma },
  ],
  exports: [ServiceDemandes, DEPOT_DEMANDES],
})
export class ModuleDemandes {}
