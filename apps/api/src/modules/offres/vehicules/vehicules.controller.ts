import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ChercherVehiculesDto, EstimerTaxiDto } from "../dto/chercher-vehicules.dto";
import { ServiceVehicules } from "./vehicules.service";

@ApiTags("vehicules")
@Controller("vehicules")
export class ControleurVehicules {
  constructor(private readonly vehicules: ServiceVehicules) {}

  @Get("estimation-taxi")
  @ApiOperation({
    summary: "Fourchette indicative pour une course de taxi",
    description: "Ce n'est pas un prix ferme : une course de taxi se convient sur place.",
  })
  async estimerTaxi(@Query() requete: EstimerTaxiDto) {
    return { donnees: await this.vehicules.estimerTaxi(requete.passagers ?? 1) };
  }

  @Get("facettes")
  @ApiOperation({
    summary: "Compteurs de filtres",
    description:
      "Chaque compteur neutralise son propre filtre : cocher « SUV » ne doit pas " +
      "faire tomber les autres catégories à zéro.",
  })
  async facettes(@Query() requete: ChercherVehiculesDto) {
    const { besoin, quand: _quand, ...criteres } = requete;
    return { donnees: await this.vehicules.facettes(besoin, criteres) };
  }

  @Get()
  @ApiOperation({ summary: "Chercher des véhicules vérifiés" })
  @ApiResponse({ status: 409, description: "`DELAI_TROP_COURT` — prise en charge trop proche (§B.3)" })
  async chercher(@Query() requete: ChercherVehiculesDto) {
    const { besoin, ...criteres } = requete;
    return { donnees: await this.vehicules.chercher(besoin, criteres) };
  }

  @Get("par-id/:id")
  @ApiOperation({ summary: "Fiche d'un véhicule par identifiant" })
  @ApiParam({ name: "id", example: "v-001" })
  @ApiResponse({ status: 404, description: "`VEHICULE_INTROUVABLE`" })
  async parId(@Param("id") id: string) {
    return { donnees: await this.vehicules.parId(id) };
  }

  @Get(":slug")
  @ApiOperation({ summary: "Fiche d'un véhicule" })
  @ApiParam({ name: "slug", example: "toyota-prado-cuir" })
  @ApiResponse({ status: 404, description: "`VEHICULE_INTROUVABLE`" })
  async parSlug(@Param("slug") slug: string) {
    return { donnees: await this.vehicules.parSlug(slug) };
  }
}
