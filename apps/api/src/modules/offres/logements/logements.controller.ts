import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { CriteresLogement } from "@teranga/contracts";

import { ChercherLogementsDto } from "../dto/chercher-logements.dto";
import { ServiceLogements } from "./logements.service";

@ApiTags("logements")
@Controller("logements")
export class ControleurLogements {
  constructor(private readonly logements: ServiceLogements) {}

  @Get()
  @ApiOperation({
    summary: "Chercher des logements vérifiés",
    description:
      "Les compteurs de filtres (`facettes`) portent sur la ville entière, pas " +
      "sur le résultat filtré : c'est ce qui permet d'élargir sa recherche.",
  })
  async chercher(@Query() requete: ChercherLogementsDto) {
    const { page, ...criteres } = requete;
    const resultats = await this.logements.chercher(
      criteres as Partial<CriteresLogement>,
      page ?? 1,
    );
    return { donnees: resultats };
  }

  @Get("par-id/:id")
  @ApiOperation({
    summary: "Fiche d'un logement par identifiant",
    description:
      "Utilisé là où le site ne connaît que l'identifiant — une demande, une " +
      "réservation — et non le slug public.",
  })
  @ApiParam({ name: "id", example: "l-004" })
  @ApiResponse({ status: 404, description: "`LOGEMENT_INTROUVABLE`" })
  async parId(@Param("id") id: string) {
    return { donnees: await this.logements.parId(id) };
  }

  @Get(":slug/avis")
  @ApiOperation({
    summary: "Avis d'un logement",
    description: "Un avis ne peut être déposé qu'après un séjour terminé.",
  })
  @ApiParam({ name: "slug", example: "villa-ngor" })
  async avis(@Param("slug") slug: string) {
    return { donnees: await this.logements.avis(slug) };
  }

  @Get(":slug")
  @ApiOperation({ summary: "Fiche d'un logement" })
  @ApiParam({ name: "slug", example: "villa-ngor" })
  @ApiResponse({ status: 404, description: "`LOGEMENT_INTROUVABLE`" })
  async parSlug(@Param("slug") slug: string) {
    return { donnees: await this.logements.parSlug(slug) };
  }
}
