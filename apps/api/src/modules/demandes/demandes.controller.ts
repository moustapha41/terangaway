import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ErreurMetier } from "../../commun/erreurs";
import { ServiceComptes } from "../comptes/comptes.service";
import { CreerDemandeLogementDto } from "./dto/creer-demande-logement.dto";
import { CreerDemandeVehiculeDto } from "./dto/creer-demande-vehicule.dto";
import { ServiceDemandes } from "./demandes.service";

/**
 * Création des demandes.
 *
 * L'identité du visiteur passe par la session (`X-Visiteur-Id` en démo) ou
 * par un code OTP fourni dans le corps — même mécanique que le mock actuel.
 */
@ApiTags("demandes")
@Controller("demandes")
export class ControleurDemandes {
  constructor(
    private readonly demandes: ServiceDemandes,
    private readonly comptes: ServiceComptes,
  ) {}

  @Post("logement")
  @ApiOperation({ summary: "Envoyer une demande de logement" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  async creerLogement(
    @Body() corps: CreerDemandeLogementDto,
    @Headers("x-visiteur-id") visiteurHeader?: string,
  ) {
    const visiteurId = await this.comptes.exigerVisiteur(visiteurHeader, corps.code);
    const demande = await this.demandes.creerLogement({
      logementId: corps.logementId,
      debut: corps.debut,
      fin: corps.fin,
      personnes: corps.personnes,
      heureArrivee: corps.heureArrivee,
      message: corps.message,
      visiteurId,
    });
    return { donnees: demande };
  }

  @Post("vehicule")
  @ApiOperation({ summary: "Envoyer une demande de transport" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  async creerVehicule(
    @Body() corps: CreerDemandeVehiculeDto,
    @Headers("x-visiteur-id") visiteurHeader?: string,
  ) {
    const visiteurId = await this.comptes.exigerVisiteur(visiteurHeader, corps.code);

    // Deux heures minimum pour un trajet (§B.3).
    if (corps.prestation === "trajet") {
      const ecart = new Date(corps.quand).getTime() - Date.now();
      if (ecart < 2 * 60 * 60 * 1000) {
        throw new ErreurMetier(
          "DELAI_TROP_COURT",
          "La prise en charge est demandée dans moins de deux heures.",
        );
      }
    }

    const demande = await this.demandes.creerVehicule({
      vehiculeId: corps.vehiculeId,
      prestation: corps.prestation,
      depart: corps.depart,
      arrivee: corps.arrivee,
      quand: corps.quand,
      passagers: corps.passagers,
      bagages: corps.bagages,
      vol: corps.vol,
      message: corps.message,
      visiteurId,
    });
    return { donnees: demande };
  }
}
