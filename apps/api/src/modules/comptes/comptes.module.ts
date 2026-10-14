import { Module } from "@nestjs/common";

import { DEPOT_COMPTES } from "../../commun/depots/depot";
import { ControleurComptes } from "./comptes.controller";
import { DepotComptesFixtures } from "./comptes.fixtures";
import { ServiceComptes } from "./comptes.service";

@Module({
  controllers: [ControleurComptes],
  providers: [
    ServiceComptes,
    { provide: DEPOT_COMPTES, useClass: DepotComptesFixtures },
  ],
  exports: [ServiceComptes],
})
export class ModuleComptes {}
