import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Demande, GenreDemande } from "@teranga/contracts";

import { ServiceEmail } from "../../commun/email/email.service";
import { ErreurMetier } from "../../commun/erreurs";
import { config } from "../../config/configuration";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import { delaiAcompteHeures } from "../acomptes/calcul";
import { DUREE_LIEN_DEMANDE_HEURES, ServiceComptes, type VisiteurDeDemande } from "../comptes/comptes.service";
import { CreerDemandeLogementDto } from "./dto/creer-demande-logement.dto";
import { CreerDemandeServiceDto } from "./dto/creer-demande-service.dto";
import { CreerDemandeVehiculeDto } from "./dto/creer-demande-vehicule.dto";
import { ServiceDemandes } from "./demandes.service";

/** Ce qui est réellement parti après l'enregistrement d'une demande. */
export interface NotificationDemande {
  emailEnvoye: boolean;
  /**
   * L'e-mail annonce-t-il un acompte à venir ? Faux tant que `ACOMPTE_ACTIF`
   * est fermé : l'écran de confirmation ne doit alors laisser attendre aucune
   * instruction de paiement.
   */
  acompteAnnonce: boolean;
}

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
    const notification = await this.previenir(visiteur, demande, corps.contact, "logement");
    return { donnees: demande, notification };
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
    const notification = await this.previenir(visiteur, demande, corps.contact, genreDeVehicule(corps.prestation));
    return { donnees: demande, notification };
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
    const notification = await this.previenir(visiteur, demande, corps.contact, "service");
    return { donnees: demande, notification };
  }

  /**
   * Les deux écrits qui suivent une demande : l'accusé au visiteur, l'alerte à
   * l'équipe.
   *
   * Ils partent ensemble et aucun des deux ne peut faire échouer la demande :
   * elle est enregistrée, et un e-mail qui ne part pas ne doit pas effacer cela
   * de l'écran du visiteur. Les deux services avalent leurs erreurs et les
   * journalisent — c'est leur contrat, pas une négligence d'ici.
   *
   * En parallèle, parce qu'ils ne dépendent pas l'un de l'autre et que le
   * visiteur attend devant son écran pendant ce temps.
   */
  private async previenir(
    visiteur: VisiteurDeDemande,
    demande: Demande,
    contact: { nom?: string; email?: string; telephone?: string } | undefined,
    genre: GenreDemande,
  ): Promise<NotificationDemande> {
    // Le jeton d'abord : c'est lui qui décide à qui va le pouvoir de répondre,
    // et donc ce que contiendra chacun des deux e-mails.
    const equipe = await this.comptes.adressesEquipe();
    const reponse = await this.demandes.emettreJetonReponse(demande.id).catch(() => null);
    const lienReponse = reponse ? lienDeReponse(reponse.jeton) : undefined;

    // L'équipe garde toujours le lien : c'est elle qui répond des vingt-quatre
    // annonces collectées, et la laisser sans moyen de décider serait revenir
    // au point de départ. Le propriétaire reçoit le sien **en plus**, quand il
    // a une adresse à lui. Le jeton ne sert qu'une fois : le premier qui
    // tranche a tranché, et c'est bien ainsi — une demande n'a qu'une réponse.
    const adresseProprietaire = reponse?.prestataire.email?.trim().toLowerCase();
    const proprietaireDistinct =
      adresseProprietaire !== undefined && !equipe.includes(adresseProprietaire);

    const [emailVisiteur] = await Promise.all([
      this.confirmerParEmail(visiteur, demande, genre),
      this.alerterEquipe(visiteur, demande, equipe, contact, { lienReponse }),
      proprietaireDistinct && lienReponse
        ? this.email.envoyerDemandeAuPartenaire(adresseProprietaire, {
            reference: demande.reference,
            titre: demande.offre.titre,
            sejour: periode(demande),
            personnes: demande.personnes,
            total: demande.prix.total > 0 ? formaterFrancs(demande.prix.total) : undefined,
            message: demande.message,
            repondreAvant: demande.expireLe ? echeance(demande.expireLe) : undefined,
            lienReponse,
          })
        : Promise.resolve(),
    ]);

    // Ce que l'écran de confirmation peut affirmer, et rien de plus : le
    // visiteur ne doit pas attendre un e-mail qui n'est pas parti.
    return {
      emailEnvoye: emailVisiteur.envoye,
      acompteAnnonce: emailVisiteur.acompteAnnonce,
    };
  }

  /**
   * Accuse réception de la demande à son auteur — et lui remet ses identifiants
   * si le compte vient de naître.
   *
   * C'est le seul moment où le mot de passe engendré existe en clair, et il ne
   * va qu'à l'adresse saisie.
   */
  private async confirmerParEmail(
    visiteur: VisiteurDeDemande,
    demande: Demande,
    genre: GenreDemande,
  ): Promise<{ envoye: boolean; acompteAnnonce: boolean }> {
    if (!visiteur.email) return { envoye: false, acompteAnnonce: false };

    // Le lien qui ramène le visiteur à **sa** demande, sans mot de passe. Un
    // lien qu'on n'a pas pu mémoriser ne part pas : mieux vaut un e-mail sans
    // lien qu'un lien qui ne mène nulle part.
    const lien = await this.comptes
      .emettreLienDemande({
        compteId: visiteur.compteId,
        email: visiteur.email,
        demandeId: demande.id,
      })
      .catch(() => null);

    // L'acompte n'est annoncé que s'il sera réellement demandé à
    // l'acceptation : verrou ouvert, genre éligible, prix connu.
    //
    // Le délai est celui **du genre**, lu dans la même table que l'éligibilité.
    // Un délai unique annonçait douze heures à une location qui n'en a que
    // trois : l'e-mail promettait alors un délai que le dossier ne donnerait pas.
    const { actif, pourcentage } = config.acompte;
    const delaiHeures = delaiAcompteHeures(genre);
    const annonceAcompte =
      actif && pourcentage !== undefined && delaiHeures !== undefined && demande.prix.total > 0
        ? { pourcentage, delaiHeures }
        : undefined;

    const { envoye } = await this.email.envoyerConfirmationDemande(visiteur.email, {
      reference: demande.reference,
      titre: demande.offre.titre,
      sejour: periode(demande),
      total: demande.prix.total > 0 ? formaterFrancs(demande.prix.total) : undefined,
      identifiants: visiteur.identifiants,
      acompte: annonceAcompte,
      lienAcces: lien
        ? {
            url: `${config.appUrl.replace(/\/$/, "")}/fr/acces-demande/${lien.jeton}`,
            validiteHeures: DUREE_LIEN_DEMANDE_HEURES,
          }
        : undefined,
    });
    return { envoye, acompteAnnonce: annonceAcompte !== undefined };
  }

  /**
   * Signale la demande à l'équipe.
   *
   * Sans cela, une demande attendait qu'on pense à ouvrir le backoffice, et
   * les deux heures de réponse de l'hôte s'écoulaient en silence.
   *
   * Le mot de passe provisoire, lui, ne figure nulle part ici : il ne va qu'à
   * l'adresse du visiteur, jamais dans une boîte interne.
   */
  private async alerterEquipe(
    visiteur: VisiteurDeDemande,
    demande: Demande,
    destinataires: readonly string[],
    contact?: { nom?: string; email?: string; telephone?: string },
    liens: { lienReponse?: string } = {},
  ): Promise<void> {
    await this.email.alerterEquipe(destinataires, {
      reference: demande.reference,
      genre: demande.offre.genre === "service" ? demande.offre.service : demande.offre.genre,
      titre: demande.offre.titre,
      sejour: periode(demande),
      personnes: demande.personnes,
      total: demande.prix.total > 0 ? formaterFrancs(demande.prix.total) : undefined,
      message: demande.message,
      repondreAvant: demande.expireLe ? echeance(demande.expireLe) : undefined,
      contact: {
        nom: contact?.nom?.trim() || undefined,
        email: visiteur.email,
        telephone: contact?.telephone?.trim() || undefined,
      },
      lien: `${config.appUrl.replace(/\/$/, "")}/fr/admin/demandes/${demande.id}`,
      lienReponse: liens.lienReponse,
    });
  }
}

/** Le genre que le dépôt écrira en base pour cette prestation. */
function genreDeVehicule(prestation: "trajet" | "journee" | "taxi"): GenreDemande {
  return prestation === "journee" ? "location" : prestation;
}

/** L'écran de réponse du partenaire, hors langue et sans connexion. */
function lienDeReponse(jeton: string): string {
  return `${config.appUrl.replace(/\/$/, "")}/reponse/${jeton}`;
}

/**
 * « aujourd'hui à 22 h 36 » — l'heure de Dakar, qui est celle de l'équipe.
 *
 * Le serveur peut tourner ailleurs ; l'échéance, elle, se lit à Dakar. Donner
 * l'heure du conteneur ferait courir après une demande déjà expirée.
 */
function echeance(iso: string): string {
  const quand = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Africa/Dakar",
    hour: "2-digit",
    minute: "2-digit",
  };
  const heure = quand.toLocaleTimeString("fr-FR", options);
  const jour = quand.toLocaleDateString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "numeric",
    month: "long",
  });
  return `${jour} à ${heure}`;
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
