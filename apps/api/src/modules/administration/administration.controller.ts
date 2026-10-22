import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import { ServiceComptes } from "../comptes/comptes.service";
import { lireFiltres } from "./administration.filtres";
import { ServiceAdministration } from "./administration.service";
import { ServiceCoordonnees } from "./coordonnees.service";
import { SaisirCoordonneesDto, VerifierCoordonneesDto } from "./dto/coordonnees.dto";
import { MettreAJourDemandeDto } from "./dto/mettre-a-jour-demande.dto";

/**
 * Le backoffice : recevoir les demandes, les lire en entier, les traiter.
 *
 * Chaque route commence par `exigerAdministrateur`. Il n'y a pas de garde
 * globale posée une fois pour toutes : une route ajoutée plus tard hériterait
 * silencieusement de l'autorisation, et c'est exactement ainsi qu'on ouvre un
 * backoffice sans s'en apercevoir. Ici, qui n'appelle pas la vérification ne
 * passe pas — et cela se voit à la lecture.
 */
@ApiTags("administration")
@Controller("administration")
export class ControleurAdministration {
  constructor(
    private readonly administration: ServiceAdministration,
    private readonly comptes: ServiceComptes,
    private readonly coordonnees: ServiceCoordonnees,
  ) {}

  @Get("moi")
  @ApiOperation({ summary: "Le compte d'équipe derrière la session, ou 401/403" })
  @ApiHeader({ name: "authorization", required: false })
  async moi(
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const compte = await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: compte };
  }

  @Get("tableau-de-bord")
  @ApiOperation({ summary: "Les compteurs de la journée" })
  async tableauDeBord(
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.administration.tableauDeBord() };
  }

  @Get("demandes")
  @ApiOperation({ summary: "Les demandes reçues, filtrées et paginées" })
  async lister(
    @Query() requete: Record<string, string | undefined>,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.administration.lister(lireFiltres(requete)) };
  }

  @Get("demandes/export")
  @ApiOperation({ summary: "Les mêmes demandes, en CSV" })
  async exporter(
    @Query() requete: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    const csv = await this.administration.exporterCsv(lireFiltres(requete));
    const jour = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="demandes-${jour}.csv"`);
    // Une extraction de demandes ne se met jamais en cache, nulle part.
    res.setHeader("Cache-Control", "no-store");
    return csv;
  }

  @Get("prestataires")
  @ApiOperation({ summary: "Les comptes partenaires, pour l'assignation" })
  async prestataires(
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.administration.listerPrestataires() };
  }

  @Get("demandes/:id")
  @ApiOperation({ summary: "Une demande, avec tout ce qui va avec" })
  async obtenir(
    @Param("id") id: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.administration.obtenir(id) };
  }

  @Patch("demandes/:id")
  @ApiOperation({
    summary: "Traiter une demande",
    description:
      "Statut, motif de refus, prestataire assigné, proposition chiffrée et note interne. " +
      "Le statut suit la table des transitions, acteur « equipe ».",
  })
  async mettreAJour(
    @Param("id") id: string,
    @Body() corps: MettreAJourDemandeDto,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    await this.exigerAdmin(authHeader, cookieHeader);
    const demande = await this.administration.mettreAJour(id, {
      statut: corps.statut,
      motifRefus: corps.motifRefus,
      prestataireId: corps.prestataireId,
      noteInterne: corps.noteInterne,
      prixPropose: corps.prixPropose,
    });
    return { donnees: demande };
  }

  /*
   * Les coordonnées d'une réservation. Trois routes, chacune avec sa propre
   * vérification d'administrateur, et `no-store` posé **avant** elle : une
   * réponse — même un refus — ne doit rester dans aucun cache.
   */

  @Get("demandes/:id/coordonnees")
  @ApiOperation({
    summary: "Les coordonnées d'une réservation, et qui les a saisies et vérifiées",
  })
  async lireCoordonnees(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.coordonnees.lire(id, acteur) };
  }

  @Put("demandes/:id/coordonnees")
  @ApiOperation({
    summary: "Saisir ou corriger les coordonnées",
    description:
      "Seulement à « acceptee » ou « confirmee ». Les champs dépendent du genre : logement ou véhicule. " +
      "Toute saisie annule la vérification précédente.",
  })
  async saisirCoordonnees(
    @Param("id") id: string,
    @Body() corps: SaisirCoordonneesDto,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.coordonnees.saisir(id, { ...corps }, acteur) };
  }

  @Post("demandes/:id/coordonnees/verification")
  @ApiOperation({
    summary: "Vérifier les coordonnées saisies par une autre personne",
    description: "Refusé à la personne qui a fait la dernière saisie (quatre yeux).",
  })
  async verifierCoordonnees(
    @Param("id") id: string,
    @Body() corps: VerifierCoordonneesDto,
    @Res({ passthrough: true }) res: Response,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const acteur = await this.exigerAdmin(authHeader, cookieHeader);
    return { donnees: await this.coordonnees.verifier(id, corps.saisieLe, acteur) };
  }

  private exigerAdmin(authHeader?: string, cookieHeader?: string) {
    const jeton = extraireJetonRequete(undefined, authHeader, cookieHeader);
    return this.comptes.exigerAdministrateur(jeton);
  }
}
