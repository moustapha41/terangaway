import { Module } from "@nestjs/common";

import { DEPOT_ACOMPTES } from "../../commun/depots/depot";
import { ModuleComptes } from "../comptes/comptes.module";
import { ControleurAcomptesAdmin } from "./acomptes.admin.controller";
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { ServiceAcomptes } from "./acomptes.service";

/**
 * Module « acomptes » — l'acompte par virement bancaire.
 *
 * Le service est appelé par `ModuleDemandes` à l'acceptation. Le seul accès HTTP
 * est celui de l'équipe (`ControleurAcomptesAdmin`), protégé route par route :
 * rien de l'acompte n'est exposé à un visiteur. Il est importé par ce module
 * plutôt que par la racine, qui est figée.
 */
@Module({
  imports: [ModuleComptes],
  controllers: [ControleurAcomptesAdmin],
  providers: [ServiceAcomptes, { provide: DEPOT_ACOMPTES, useClass: DepotAcomptesPrisma }],
  exports: [ServiceAcomptes],
})
export class ModuleAcomptes {}
