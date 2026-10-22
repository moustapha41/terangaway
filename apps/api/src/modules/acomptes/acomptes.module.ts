import { Module } from "@nestjs/common";

import { DEPOT_ACOMPTES } from "../../commun/depots/depot";
import { DepotAcomptesPrisma } from "./acomptes.prisma";
import { ServiceAcomptes } from "./acomptes.service";

/**
 * Module « acomptes » — l'acompte par virement bancaire.
 *
 * Aucun contrôleur : à cette étape, rien ne s'expose par HTTP. Le service est
 * appelé par `ModuleDemandes` à l'acceptation, et c'est tout. Il est importé
 * par ce module plutôt que par la racine, qui est figée.
 */
@Module({
  providers: [ServiceAcomptes, { provide: DEPOT_ACOMPTES, useClass: DepotAcomptesPrisma }],
  exports: [ServiceAcomptes],
})
export class ModuleAcomptes {}
