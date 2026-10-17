import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ErreurMetier } from "../../commun/erreurs";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import { ServiceComptes } from "../comptes/comptes.service";
import { CreerDemandeLogementDto } from "./dto/creer-demande-logement.dto";
import { CreerDemandeServiceDto } from "./dto/creer-demande-service.dto";
import { CreerDemandeVehiculeDto } from "./dto/creer-demande-vehicule.dto";
import { ServiceDemandes } from "./demandes.service";

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
  @ApiHeader({ name: "authorization", required: false })
  async creerLogement(
    @Body() corps: CreerDemandeLogementDto,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const jeton = extraireJetonRequete(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(jeton, corps.code);
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
  @ApiHeader({ name: "authorization", required: false })
  async creerVehicule(
    @Body() corps: CreerDemandeVehiculeDto,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const jeton = extraireJetonRequete(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(jeton, corps.code);

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

  @Post("service")
  @ApiOperation({
    summary: "Envoyer une demande de service sans catalogue",
    description:
      "Aucun prix n'est figé : le total vaut zéro tant que l'équipe n'a pas chiffré depuis le backoffice.",
  })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  async creerService(
    @Body() corps: CreerDemandeServiceDto,
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const jeton = extraireJetonRequete(visiteurHeader, authHeader, cookieHeader);
    const visiteurId = await this.comptes.exigerVisiteur(jeton, corps.code);

    // Les détails arrivent du formulaire : on les ramène à des chaînes, et on
    // écarte les champs vides plutôt que de les écrire dans la base.
    const details: Record<string, string> = {};
    for (const [cle, valeur] of Object.entries(corps.details ?? {})) {
      const texte = typeof valeur === "string" ? valeur.trim() : String(valeur ?? "").trim();
      if (texte) details[cle] = texte.slice(0, 500);
    }

    const demande = await this.demandes.creerService({
      service: corps.service,
      details,
      message: corps.message,
      visiteurId,
    });
    return { donnees: demande };
  }
}
