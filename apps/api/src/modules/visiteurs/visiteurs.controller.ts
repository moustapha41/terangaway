import { Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { ServiceComptes } from "../comptes/comptes.service";
import { ServiceDemandes } from "../demandes/demandes.service";

function extraireJeton(
  visiteurHeader?: string,
  authHeader?: string,
  cookieHeader?: string,
): string | undefined {
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, "").trim();
  }
  if (visiteurHeader) {
    return visiteurHeader.trim();
  }
  if (cookieHeader) {
    const match = cookieHeader.match(/teranga_visiteur=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

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
  @ApiHeader({ name: "authorization", required: false })
  async lister(
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const identifiant = extraireJeton(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(identifiant);
    const liste = await this.demandes.listerPourVisiteur(visiteurId);
    return { donnees: liste };
  }

  @Get("moi/demandes/:id")
  @ApiOperation({ summary: "Détail d'une demande du visiteur (avec contrôle de propriété)" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  @ApiParam({ name: "id", example: "d-002" })
  async obtenir(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const identifiant = extraireJeton(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(identifiant);
    const demande = await this.demandes.obtenirPourVisiteur(id, visiteurId);
    return { donnees: demande };
  }

  @Post("moi/demandes/:id/confirmer")
  @ApiOperation({ summary: "Confirmer une demande acceptée (avec contrôle de propriété)" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  @ApiParam({ name: "id", example: "d-002" })
  async confirmer(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const identifiant = extraireJeton(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(identifiant);
    const demande = await this.demandes.confirmerPourVisiteur(id, visiteurId);
    return { donnees: demande };
  }

  @Post("moi/demandes/:id/annuler")
  @ApiOperation({ summary: "Annuler une demande en cours (avec contrôle de propriété)" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  @ApiParam({ name: "id", example: "d-001" })
  async annuler(
    @Param("id") id: string,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const identifiant = extraireJeton(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(identifiant);
    const demande = await this.demandes.annulerPourVisiteur(id, visiteurId);
    return { donnees: demande };
  }
}
