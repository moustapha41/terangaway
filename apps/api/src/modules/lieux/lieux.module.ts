import { Module } from "@nestjs/common";

import { DEPOT_LIEUX } from "../../commun/depots/depot";
import { ControleurLieux } from "./lieux.controller";
import { DepotLieuxFixtures } from "./lieux.fixtures";

@Module({
  controllers: [ControleurLieux],
  providers: [{ provide: DEPOT_LIEUX, useClass: DepotLieuxFixtures }],
})
export class ModuleLieux {}
