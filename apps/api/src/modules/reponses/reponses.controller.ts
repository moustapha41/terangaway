import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { RepondreDto } from "./dto/repondre.dto";
import { ServiceReponses } from "./reponses.service";

@ApiTags("reponses")
@Controller("reponses")
export class ControleurReponses {
  constructor(private readonly reponses: ServiceReponses) {}

  @Get(":jeton")
  @ApiOperation({ summary: "Ouvrir une demande via le jeton SMS du partenaire" })
  @ApiParam({ name: "jeton", example: "demo-valide" })
  async ouvrir(@Param("jeton") jeton: string) {
    const vue = await this.reponses.ouvrir(jeton);
    return { donnees: vue };
  }

  @Post(":jeton")
  @ApiOperation({ summary: "Accepter ou refuser via le jeton SMS" })
  @ApiParam({ name: "jeton", example: "demo-valide" })
  async repondre(@Param("jeton") jeton: string, @Body() corps: RepondreDto) {
    const vue = await this.reponses.repondre(jeton, corps.reponse, corps.motif);
    return { donnees: vue };
  }
}
