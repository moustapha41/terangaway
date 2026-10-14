import { Module } from "@nestjs/common";

import { DEPOT_JETONS } from "../../commun/depots/depot";
import { ModuleDemandes } from "../demandes/demandes.module";
import { DepotJetonsFixtures } from "./jetons.fixtures";
import { ControleurReponses } from "./reponses.controller";
import { ServiceReponses } from "./reponses.service";

@Module({
  imports: [ModuleDemandes],
  controllers: [ControleurReponses],
  providers: [
    ServiceReponses,
    { provide: DEPOT_JETONS, useClass: DepotJetonsFixtures },
  ],
  exports: [ServiceReponses],
})
export class ModuleReponses {}
