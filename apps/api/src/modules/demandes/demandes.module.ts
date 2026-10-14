import { Module } from "@nestjs/common";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ModuleComptes } from "../comptes/comptes.module";
import { ControleurDemandes } from "./demandes.controller";
import { DepotDemandesFixtures } from "./demandes.fixtures";
import { ServiceDemandes } from "./demandes.service";

@Module({
  imports: [ModuleComptes],
  controllers: [ControleurDemandes],
  providers: [
    ServiceDemandes,
    { provide: DEPOT_DEMANDES, useClass: DepotDemandesFixtures },
  ],
  exports: [ServiceDemandes],
})
export class ModuleDemandes {}
