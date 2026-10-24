import { Body, Controller, Get, Headers, Param, Post, Res } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { introuvable } from "../../commun/erreurs";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import { ServiceComptes } from "../comptes/comptes.service";
import { DeciderPaiementTardifDto, SaisirReceptionDto } from "./dto/acompte-admin.dto";
import { ServiceAcomptes } from "./acomptes.service";

/**
 * L'acompte vu par l'équipe : lecture, constat d'une réception, renvois.
 *
 * Même règle que le reste du backoffice : **chaque route appelle
 * `exigerAdmin`**, explicitement, en première ligne. Aucune garde globale ne le
 * fait pour elles, et une route ajoutée ici sans cet appel serait ouverte à
 * tous — cela doit se voir à la lecture.
 *
 * Aucune route ne reçoit de montant à *calculer* : l'acompte attendu, le
 * pourcentage et le total viennent de la base. Seul le montant **reçu** vient
 * de la personne, parce qu'elle seule voit le compte.
 *
 * Toutes les réponses portent `Cache-Control: no-store` : elles citent les
 * coordonnées de paiement.
 */
@ApiTags("administration")
@Controller("administration/demandes/:id/acompte")
export class ControleurAcomptesAdmin {
  constructor(
    private readonly acomptes: ServiceAcomptes,
    private readonly comptes: ServiceComptes,
  ) {}

  @Get()
  @ApiOperation({ summary: "L'acompte d'une demande : montants, coordonnées, journal, actions possibles" })
  @ApiHeader({ name: "authorization", required: false })
  async lire(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.acomptes.lireVue(id) };
  }

  @Post("preparation")
  @ApiOperation({
    summary: "Ouvrir l'acompte d'une demande déjà acceptée",
    description: "Pour une demande acceptée alors que l'acompte était fermé. Recalculé côté serveur.",
  })
  async preparer(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    await this.exigerAdmin(authHeader, cookieHeader);
    const issue = await this.acomptes.ouvrir(id);
    return { donnees: { issue, vue: await this.acomptes.lireVue(id) } };
  }

  @Post("reception")
  @ApiOperation({
    summary: "Constater la réception d'un versement, après vérification du compte",
    description:
      "Réservé aux administrateurs. Un montant différent du reste dû exige ecartConfirme et un commentaire. " +
      "Un cumul périmé, un doublon de référence ou un double clic sont refusés (409). " +
      "Ne change jamais le statut de la demande.",
  })
  async confirmerReception(
    @Param("id") id: string,
    @Body() corps: SaisirReceptionDto,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    const resultat = await this.acomptes.confirmerReception(id, { ...corps }, acteur.id);
    return { donnees: { resultat, vue: await this.acomptes.lireVue(id) } };
  }

  @Post("instructions/renvoi")
  @ApiOperation({ summary: "Renvoyer les instructions de paiement (aucun paiement n'est créé)" })
  async renvoyerInstructions(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    const issue = await this.acomptes.renvoyerInstructionsPourDemande(id, acteur.id);
    return { donnees: { issue, vue: await this.acomptes.lireVue(id) } };
  }

  @Post("reception/confirmation/renvoi")
  @ApiOperation({ summary: "Renvoyer l'e-mail de réception (le cumul reçu ne bouge pas)" })
  async renvoyerConfirmation(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    const etat = await this.acomptes.renvoyerConfirmation(id, acteur.id);
    return { donnees: { etat, vue: await this.acomptes.lireVue(id) } };
  }

  @Post("paiement-tardif")
  @ApiOperation({
    summary: "Décider d'un paiement arrivé après l'échéance",
    description: "Accepter exige une demande encore vivante et un commentaire ; rembourser ne rembourse rien lui-même.",
  })
  async deciderPaiementTardif(
    @Param("id") id: string,
    @Body() corps: DeciderPaiementTardifDto,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    const vue = await this.acomptes.lireVue(id);
    if (!vue.acompte) throw introuvable("Acompte");
    await this.acomptes.deciderPaiementTardif(vue.acompte.id, { ...corps, acteurId: acteur.id });
    return { donnees: { vue: await this.acomptes.lireVue(id) } };
  }

  private exigerAdmin(authHeader?: string, cookieHeader?: string) {
    const jeton = extraireJetonRequete(undefined, authHeader, cookieHeader);
    return this.comptes.exigerAdministrateur(jeton);
  }
}
