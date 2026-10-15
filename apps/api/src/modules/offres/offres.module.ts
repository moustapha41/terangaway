import { Module } from "@nestjs/common";

import { DEPOT_LOGEMENTS, DEPOT_VEHICULES } from "../../commun/depots/depot";
import { ControleurLogements } from "./logements/logements.controller";
import { DepotLogementsFixtures } from "./logements/logements.fixtures";
import { ServiceLogements } from "./logements/logements.service";
import { ControleurVehicules } from "./vehicules/vehicules.controller";
import { DepotVehiculesFixtures } from "./vehicules/vehicules.fixtures";
import { ServiceVehicules } from "./vehicules/vehicules.service";

/**
 * Module « offres » — le catalogue que le visiteur consulte.
 *
 * Le jour de Postgres, une seule ligne change ici : `useClass`.
 */
@Module({
  controllers: [ControleurLogements, ControleurVehicules],
  providers: [
    ServiceLogements,
    ServiceVehicules,
    { provide: DEPOT_LOGEMENTS, useClass: DepotLogementsFixtures },
    { provide: DEPOT_VEHICULES, useClass: DepotVehiculesFixtures },
  ],
  exports: [ServiceLogements, ServiceVehicules, DEPOT_LOGEMENTS, DEPOT_VEHICULES],
})
export class ModuleOffres {}
