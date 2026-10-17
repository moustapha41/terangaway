import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type {
  FiltresDemandesAdmin,
  GenreDemande,
  ServiceALaDemande,
  StatutDemande,
} from "@teranga/contracts";
import {
  GENRES_DEMANDE,
  SERVICES_A_LA_DEMANDE,
  STATUTS_DEMANDE,
} from "@teranga/contracts";

import { extraireJetonRequete } from "../../commun/securite/hachage";
import { ServiceComptes } from "../comptes/comptes.service";
import { ServiceAdministration } from "./administration.service";
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

  private exigerAdmin(authHeader?: string, cookieHeader?: string) {
    const jeton = extraireJetonRequete(undefined, authHeader, cookieHeader);
    return this.comptes.exigerAdministrateur(jeton);
  }
}

/**
 * La requête, ramenée aux filtres que le dépôt connaît.
 *
 * Une valeur inconnue est ignorée plutôt que refusée : un filtre obsolète
 * dans une URL partagée par courriel doit rendre une liste, pas une erreur.
 */
function lireFiltres(requete: Record<string, string | undefined>): FiltresDemandesAdmin {
  const dans = <T extends string>(liste: readonly T[], valeur?: string): T | undefined =>
    valeur && (liste as readonly string[]).includes(valeur) ? (valeur as T) : undefined;

  const entier = (valeur?: string): number | undefined => {
    const n = Number(valeur);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  const jour = (valeur?: string): string | undefined =>
    valeur && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : undefined;

  return {
    statut: dans<StatutDemande>(STATUTS_DEMANDE, requete.statut),
    genre: dans<GenreDemande>(GENRES_DEMANDE, requete.genre),
    service: dans<ServiceALaDemande>(SERVICES_A_LA_DEMANDE, requete.service),
    recherche: requete.recherche?.trim().slice(0, 120) || undefined,
    du: jour(requete.du),
    au: jour(requete.au),
    page: entier(requete.page),
    parPage: entier(requete.parPage),
  };
}
