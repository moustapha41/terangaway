import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { DEPOT_DEMANDES } from "../../commun/depots/depot";
import { ServiceEmail } from "../../commun/email/email.service";
import type { LigneRelance } from "../../commun/email/modeles/relance-equipe.modele";
import { config } from "../../config/configuration";
import { ServiceComptes } from "../comptes/comptes.service";
import type { DemandeARelancer, DepotDemandes } from "./demandes.depot";
import { ServiceDemandes } from "./demandes.service";
import { DELAIS, type GenreService } from "./machine-a-etats/delais";

/** Toutes les cinq minutes : assez fin pour un taxi (relance à dix minutes). */
const PERIODE_MINUTES = 5;

/** Jamais plus d'une page de relances d'un coup : un e-mail reste lisible. */
const LIMITE_PAR_PASSAGE = 25;

/**
 * Combien de demandes prononcer expirées par passage.
 *
 * Plus large que les relances — personne ne lit ces lignes-là, elles ne font
 * que ranger la base — mais borné quand même : le premier passage après une
 * mise en ligne peut trouver un arriéré, et une boucle sans fin sur une table
 * qui grossit n'est pas une tâche de fond, c'est une panne.
 */
const LIMITE_EXPIRATIONS = 200;

/**
 * Le veilleur : il regarde ce que personne n'a regardé.
 *
 * Une demande arrivait, l'alerte partait, et si personne ne la voyait — nuit,
 * téléphone en silencieux, notification manquée — les deux heures de réponse
 * s'écoulaient en silence. Le visiteur n'avait alors rien : ni réponse, ni
 * refus, juste une demande expirée. C'est le défaut que ce service comble.
 *
 * Il ne décide de rien : il ne change aucun statut, n'annule ni n'accepte. Il
 * dit seulement « celles-ci attendent depuis trop longtemps », une fois par
 * demande, à l'équipe. Le reste appartient à des humains.
 *
 * Les délais viennent du PRD §10 et dépendent du service : dix minutes pour un
 * taxi, une heure pour un logement. Relancer un taxi au bout d'une heure
 * reviendrait à ne pas le relancer du tout.
 *
 * Une seule instance de l'API est prévue. Le jour où il y en aura deux, elles
 * relanceront chacune de leur côté : il faudra alors un verrou en base, que
 * `relanceeLe` permet déjà d'écrire.
 */
@Injectable()
export class VeilleurDemandes implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VeilleurDemandes.name);
  private minuterie: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DEPOT_DEMANDES) private readonly depot: DepotDemandes,
    private readonly demandes: ServiceDemandes,
    private readonly comptes: ServiceComptes,
    private readonly email: ServiceEmail,
  ) {}

  onModuleInit(): void {
    if (!this.depot.aRelancer && !this.depot.aExpirer) {
      this.logger.warn("Dépôt sans veille : ni relance, ni expiration automatique.");
      return;
    }

    this.minuterie = setInterval(
      () => {
        void this.veiller().catch((erreur) => {
          // Une veille qui lève emporterait la minuterie avec elle, et le
          // silence reviendrait sans que personne ne l'ait demandé.
          this.logger.error(`Veille interrompue : ${(erreur as Error)?.message ?? erreur}`);
        });
      },
      PERIODE_MINUTES * 60_000,
    );

    // Sans `unref`, la minuterie retient le processus : un conteneur qu'on
    // arrête attendrait cinq minutes, et un test ne rendrait jamais la main.
    this.minuterie.unref?.();
    this.logger.log(`Veille des demandes active (toutes les ${PERIODE_MINUTES} minutes).`);
  }

  onModuleDestroy(): void {
    if (this.minuterie) clearInterval(this.minuterie);
    this.minuterie = null;
  }

  /**
   * Un passage de veille. Rend le nombre de demandes signalées.
   *
   * Publique, et c'est voulu : c'est par elle que la veille se teste, sans
   * attendre cinq minutes ni monter une application entière.
   */
  async veiller(maintenant: Date = new Date()): Promise<number> {
    // L'expiration d'abord : inutile de relancer l'équipe sur une demande que
    // le même passage va déclarer morte.
    await this.expirer(maintenant);

    if (!this.depot.aRelancer) return 0;

    const enSouffrance = await this.depot.aRelancer(seuils(maintenant), LIMITE_PAR_PASSAGE);
    if (enSouffrance.length === 0) return 0;

    const destinataires = await this.comptes.adressesEquipe();
    await this.email.relancerEquipe(
      destinataires,
      enSouffrance.map((demande) => ligne(demande, maintenant)),
    );

    // Marquées quoi qu'il advienne de l'e-mail : une relance qui échoue est
    // écrite dans le journal, tandis qu'une relance rejouée toutes les cinq
    // minutes finirait par être filtrée — et c'est bien pire.
    await this.depot.marquerRelancees?.(enSouffrance.map((d) => d.id));

    return enSouffrance.length;
  }

  /**
   * Prononce l'expiration des demandes dont l'échéance est passée.
   *
   * Rien d'autre ne le faisait : une demande sans réponse restait « envoyée »
   * pour toujours, le tableau de bord la comptait indéfiniment « en retard »,
   * et le visiteur lisait « votre hôte répond en moins d'une heure » devant
   * une demande vieille de trois jours.
   *
   * La transition passe par la machine à états, acteur « systeme », comme
   * toute autre : elle est refusée si elle n'est pas permise, et elle écrit
   * son passage dans la frise. Une demande qui résiste n'arrête pas les
   * suivantes — c'est une tâche de fond, pas une transaction.
   */
  private async expirer(maintenant: Date): Promise<number> {
    if (!this.depot.aExpirer) return 0;

    const ids = await this.depot.aExpirer(maintenant, LIMITE_EXPIRATIONS);
    let prononcees = 0;

    for (const id of ids) {
      try {
        await this.demandes.transitionner(id, "expiree", "systeme");
        prononcees += 1;
      } catch (erreur) {
        this.logger.warn(`Expiration refusée pour ${id} : ${(erreur as Error)?.message ?? erreur}`);
      }
    }

    if (prononcees > 0) this.logger.log(`${prononcees} demande(s) expirée(s).`);
    return prononcees;
  }
}

/**
 * La date de création au-delà de laquelle une demande est en souffrance,
 * genre par genre.
 */
function seuils(maintenant: Date): Record<string, Date> {
  const table: Record<string, Date> = {};
  for (const [genre, delais] of Object.entries(DELAIS) as [GenreService, (typeof DELAIS)[GenreService]][]) {
    table[genre] = new Date(maintenant.getTime() - delais.relanceMinutes * 60_000);
  }
  return table;
}

function ligne(demande: DemandeARelancer, maintenant: Date): LigneRelance {
  return {
    reference: demande.reference,
    genre: demande.genre,
    titre: demande.titre,
    depuis: depuis(new Date(demande.creeLe), maintenant),
    echeance: demande.expireLe ? echeance(new Date(demande.expireLe), maintenant) : undefined,
    lien: `${config.appUrl.replace(/\/$/, "")}/fr/admin/demandes/${demande.id}`,
  };
}

/** « depuis 1 h 20 », « depuis 35 min ». */
function depuis(creeLe: Date, maintenant: Date): string {
  const minutes = Math.max(1, Math.round((maintenant.getTime() - creeLe.getTime()) / 60_000));
  if (minutes < 60) return `depuis ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `depuis ${heures} h` : `depuis ${heures} h ${String(reste).padStart(2, "0")}`;
}

/**
 * Ce qu'il reste avant l'expiration — ou le constat qu'elle est passée.
 *
 * « expire dans 12 min » n'appelle pas le même geste que « expirée depuis
 * 3 h » : la première se rattrape, la seconde se répare.
 */
function echeance(expireLe: Date, maintenant: Date): string {
  const minutes = Math.round((expireLe.getTime() - maintenant.getTime()) / 60_000);
  if (minutes <= 0) return `expirée ${depuis(expireLe, maintenant).replace("depuis", "depuis")}`;
  if (minutes < 60) return `expire dans ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  return `expire dans ${heures} h`;
}
