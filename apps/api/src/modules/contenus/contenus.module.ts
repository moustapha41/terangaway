import { Module } from "@nestjs/common";

/**
 * Module « contenus ».
 *
 * Coquille posée par le socle pour que `app.module.ts` n'ait plus jamais à
 * être rouvert : chaque personne remplit son module sans toucher au fichier
 * que l'autre modifie aussi.
 */
@Module({})
export class ModuleContenus {}
