import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { DEPOT_LIEUX } from "../../commun/depots/depot";
import type { DepotLieux } from "./lieux.depot";

@ApiTags("lieux")
@Controller("lieux")
export class ControleurLieux {
  constructor(@Inject(DEPOT_LIEUX) private readonly depot: DepotLieux) {}

  @Get()
  @ApiOperation({
    summary: "Points de repère proposés à la saisie",
    description: "Aéroport, sites des Jeux, quartiers. Jamais une adresse de partenaire.",
  })
  async tous() {
    return { donnees: await this.depot.tous() };
  }

  @Get("villes")
  @ApiOperation({ summary: "Villes où des offres existent" })
  async villes() {
    return { donnees: await this.depot.villes() };
  }

  @Get("quartiers")
  @ApiOperation({ summary: "Quartiers, éventuellement bornés à une ville" })
  @ApiQuery({ name: "ville", required: false, example: "Dakar" })
  async quartiers(@Query("ville") ville?: string) {
    return { donnees: await this.depot.quartiers(ville) };
  }
}
