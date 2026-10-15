import { Module } from "@nestjs/common";

import { DEPOT_JETONS } from "../../commun/depots/depot";
import { ModuleDemandes } from "../demandes/demandes.module";
import { DepotJetonsPrisma } from "./jetons.prisma";
import { ControleurReponses } from "./reponses.controller";
import { ServiceReponses } from "./reponses.service";

@Module({
  imports: [ModuleDemandes],
  controllers: [ControleurReponses],
  providers: [
    ServiceReponses,
    { provide: DEPOT_JETONS, useClass: DepotJetonsPrisma },
  ],
  exports: [ServiceReponses, DEPOT_JETONS],
})
export class ModuleReponses {}
