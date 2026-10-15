import { Module } from "@nestjs/common";

import { PrismaModule } from "./base-de-donnees/prisma.module";
import { ModuleEmail } from "./commun/email/email.module";
import { ModuleAdministration } from "./modules/administration/administration.module";
import { ModuleAssistance } from "./modules/assistance/assistance.module";
import { ModuleComptes } from "./modules/comptes/comptes.module";
import { ModuleContenus } from "./modules/contenus/contenus.module";
import { ModuleDemandes } from "./modules/demandes/demandes.module";
import { ModuleLieux } from "./modules/lieux/lieux.module";
import { ModuleNotifications } from "./modules/notifications/notifications.module";
import { ModuleOffres } from "./modules/offres/offres.module";
import { ModulePartenaires } from "./modules/partenaires/partenaires.module";
import { ModuleRecherche } from "./modules/recherche/recherche.module";
import { ModuleReponses } from "./modules/reponses/reponses.module";
import { ModuleSante } from "./modules/sante/sante.module";
import { ModuleTarification } from "./modules/tarification/tarification.module";
import { ModuleTeleversement } from "./modules/televersement/televersement.module";
import { ModuleTraduction } from "./modules/traduction/traduction.module";
import { ModuleVisiteurs } from "./modules/visiteurs/visiteurs.module";

/**
 * Racine de l'API.
 *
 * Les seize modules sont déclarés **une fois pour toutes**, y compris ceux qui
 * sont encore vides. Ce fichier est le seul que deux personnes auraient eu à
 * modifier en même temps : il est figé pour que cela n'arrive jamais.
 *
 * Ajouter un contrôleur ou un service se fait dans le module concerné, pas ici.
 */
@Module({
  imports: [
    PrismaModule,
    ModuleEmail,
    ModuleSante,
    // Lecture
    ModuleOffres,
    ModuleRecherche,
    ModuleLieux,
    // Écriture
    ModuleComptes,
    ModuleDemandes,
    ModuleReponses,
    ModuleVisiteurs,
    // Plus tard
    ModuleAdministration,
    ModuleAssistance,
    ModuleContenus,
    ModuleNotifications,
    ModulePartenaires,
    ModuleTarification,
    ModuleTeleversement,
    ModuleTraduction,
  ],
})
export class AppModule {}
