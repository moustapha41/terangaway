import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

/**
 * Supervision.
 *
 * `/sante` doit répondre sans toucher à aucune dépendance : c'est ce qui permet
 * de distinguer « l'API est morte » de « la base est morte ».
 */
@ApiTags("sante")
@Controller("sante")
export class ControleurSante {
  private readonly demarreA = Date.now();

  @Get()
  @ApiOperation({ summary: "L'API répond-elle ?" })
  etat() {
    return {
      etat: "ok",
      depuisSecondes: Math.round((Date.now() - this.demarreA) / 1000),
    };
  }
}
