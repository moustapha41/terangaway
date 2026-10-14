import { Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { ServiceComptes } from "../comptes/comptes.service";
import { ServiceDemandes } from "../demandes/demandes.service";

@ApiTags("visiteurs")
@Controller("visiteurs")
export class ControleurVisiteurs {
  constructor(
    private readonly comptes: ServiceComptes,
    private readonly demandes: ServiceDemandes,
  ) {}

  @Get("moi/demandes")
  @ApiOperation({ summary: "Lister les demandes du visiteur connecté" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  async lister(@Headers("x-visiteur-id") visiteurHeader?: string) {
    const visiteurId = await this.comptes.exigerVisiteur(visiteurHeader);
    const liste = await this.demandes.listerPourVisiteur(visiteurId);
    return { donnees: liste };
  }

  @Get("moi/demandes/:id")
  @ApiOperation({ summary: "Détail d'une demande du visiteur" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiParam({ name: "id", example: "d-002" })
  async obtenir(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
  ) {
    await this.comptes.exigerVisiteur(visiteurHeader);
    const demande = await this.demandes.obtenir(id);
    return { donnees: demande };
  }

  @Post("moi/demandes/:id/confirmer")
  @ApiOperation({ summary: "Confirmer une demande acceptée" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiParam({ name: "id", example: "d-002" })
  async confirmer(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
  ) {
    await this.comptes.exigerVisiteur(visiteurHeader);
    const demande = await this.demandes.confirmer(id);
    return { donnees: demande };
  }

  @Post("moi/demandes/:id/annuler")
  @ApiOperation({ summary: "Annuler une demande en cours" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiParam({ name: "id", example: "d-001" })
  async annuler(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
  ) {
    await this.comptes.exigerVisiteur(visiteurHeader);
    const demande = await this.demandes.annuler(id);
    return { donnees: demande };
  }
}
