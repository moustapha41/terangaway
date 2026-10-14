import { Module } from "@nestjs/common";

import { ModuleComptes } from "../comptes/comptes.module";
import { ModuleDemandes } from "../demandes/demandes.module";
import { ControleurVisiteurs } from "./visiteurs.controller";

@Module({
  imports: [ModuleComptes, ModuleDemandes],
  controllers: [ControleurVisiteurs],
})
export class ModuleVisiteurs {}
