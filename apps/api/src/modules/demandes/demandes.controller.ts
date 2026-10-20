import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Demande } from "@teranga/contracts";

import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import { ServiceComptes, type VisiteurDeDemande } from "../comptes/comptes.service";
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
    private readonly email: ServiceEmail,
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
    const visiteur = await this.comptes.visiteurPourDemande(jeton, corps.contact);
    const demande = await this.demandes.creerLogement({
      logementId: corps.logementId,
      debut: corps.debut,
      fin: corps.fin,
      personnes: corps.personnes,
      heureArrivee: corps.heureArrivee,
      message: corps.message,
      visiteurId: visiteur.compteId,
    });
    await this.confirmerParEmail(visiteur, demande);
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
    const visiteur = await this.comptes.visiteurPourDemande(jeton, corps.contact);

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
      visiteurId: visiteur.compteId,
    });
    await this.confirmerParEmail(visiteur, demande);
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
    const visiteur = await this.comptes.visiteurPourDemande(jeton, corps.contact);

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
      visiteurId: visiteur.compteId,
    });
    await this.confirmerParEmail(visiteur, demande);
    return { donnees: demande };
  }

  /**
   * Accuse réception de la demande à son auteur — et lui remet ses identifiants
   * si le compte vient de naître.
   *
   * C'est le seul moment où le mot de passe engendré existe en clair, et il ne
   * va qu'à l'adresse saisie. L'envoi ne peut pas faire échouer la demande :
   * elle est enregistrée, le propriétaire l'a, et un e-mail qui ne part pas ne
   * doit pas effacer cela de l'écran du visiteur.
   */
  private async confirmerParEmail(visiteur: VisiteurDeDemande, demande: Demande): Promise<void> {
    if (!visiteur.email) return;

    await this.email.envoyerConfirmationDemande(visiteur.email, {
      reference: demande.reference,
      titre: demande.offre.titre,
      sejour: periode(demande),
      total: demande.prix.total > 0 ? formaterFrancs(demande.prix.total) : undefined,
      identifiants: visiteur.identifiants,
    });
  }
}

/** « 1 novembre 2026 → 8 novembre 2026 », ou le seul jour d'un trajet. */
function periode(demande: Demande): string | undefined {
  const { debut, fin } = demande.dates;
  if (!debut) return undefined;
  const jour = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return !fin || fin === debut ? jour(debut) : `${jour(debut)} → ${jour(fin)}`;
}

/**
 * Le total en francs, monnaie du paiement.
 *
 * Le site affiche des euros ou des dollars au visiteur, mais le règlement a
 * lieu sur place, en francs : c'est ce montant-là qu'il tendra, et c'est donc
 * celui que l'écrit doit porter.
 */
function formaterFrancs(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant).replace(/\u202f|\u00a0/g, " ")} FCFA`;
}
