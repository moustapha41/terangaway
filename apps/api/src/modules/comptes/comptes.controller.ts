import { Body, Controller, Get, Headers, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { ErreurMetier } from "../../commun/erreurs";
import { extraireIpClientSecurisee } from "../../commun/securite/adresse-ip";
import { extraireJetonRequete } from "../../commun/securite/hachage";
import {
  ConnexionMotDePasseDto,
  InscriptionDto,
  RenvoyerCodeInscriptionDto,
  VerifierInscriptionDto,
} from "./dto/inscription.dto";
import { ConnexionPrestataireDto, EnvoyerOtpDto, VerifierOtpDto } from "./dto/otp.dto";
import { ServiceComptes } from "./comptes.service";

const TRENTE_JOURS_MS = 30 * 24 * 3600 * 1000;

@ApiTags("comptes")
@Controller("comptes")
export class ControleurComptes {
  constructor(private readonly comptes: ServiceComptes) {}

  @Get("session")
  @ApiOperation({ summary: "Obtenir les informations du visiteur connecté" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  async obtenirSession(
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
  ) {
    const jeton = extraireJetonRequete(visiteurHeader, authHeader, cookieHeader);
    if (!jeton) {
      throw new ErreurMetier("NON_AUTHENTIFIE", "Session requise.", HttpStatus.UNAUTHORIZED);
    }
    const profil = await this.comptes.profilVisiteur(jeton);
    return { donnees: profil };
  }

  @Post("otp/envoyer")
  @ApiOperation({ summary: "Envoyer un code OTP au visiteur (par e-mail)" })
  async envoyer(
    @Body() corps: EnvoyerOtpDto,
    @Req() req: Request,
  ) {
    const identifiant = corps.identifiant || corps.email || corps.telephone;
    if (!identifiant) {
      throw new ErreurMetier("IDENTIFIANT_REQUIS", "Veuillez fournir un e-mail ou un numéro de téléphone.");
    }

    const ip = extraireIpClientSecurisee(req);
    const resultat = await this.comptes.envoyerOtp(identifiant, ip);
    return { donnees: resultat };
  }

  @Post("otp/verifier")
  @ApiOperation({ summary: "Vérifier le code OTP et ouvrir une session visiteur" })
  async verifier(
    @Body() corps: VerifierOtpDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const identifiant = corps.identifiant || corps.email || corps.telephone;
    if (!identifiant) {
      throw new ErreurMetier("IDENTIFIANT_REQUIS", "Veuillez fournir un e-mail ou un numéro de téléphone.");
    }

    const resultat = await this.comptes.verifierOtp(identifiant, corps.code);
    this.poserCookieSession(resultat.token, res);
    return { donnees: resultat };
  }

  /* ──────────────────────────── Inscription ───────────────────────────── */

  @Post("inscription")
  @ApiOperation({
    summary: "Ouvrir une inscription en attente et envoyer un code à l'adresse",
    description:
      "Aucune session n'est ouverte ici : le compte reste non vérifié jusqu'à " +
      "`POST /comptes/inscription/verifier`. Renvoie 409 si un compte est déjà inscrit.",
  })
  async inscription(@Body() corps: InscriptionDto, @Req() req: Request) {
    const ip = extraireIpClientSecurisee(req);
    const resultat = await this.comptes.inscrire({
      nom: corps.nom,
      email: corps.email,
      motDePasse: corps.motDePasse,
      ipAddress: ip,
    });
    return { donnees: resultat };
  }

  @Post("inscription/verifier")
  @ApiOperation({ summary: "Vérifier le code d'inscription, activer le compte et ouvrir la session" })
  async verifierInscription(
    @Body() corps: VerifierInscriptionDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const resultat = await this.comptes.verifierInscription(corps.email, corps.code);
    this.poserCookieSession(resultat.token, res);
    return { donnees: resultat };
  }

  @Post("inscription/renvoyer")
  @ApiOperation({ summary: "Renvoyer le code d'inscription (sous limitation de débit)" })
  async renvoyerInscription(
    @Body() corps: RenvoyerCodeInscriptionDto,
    @Req() req: Request,
  ) {
    const ip = extraireIpClientSecurisee(req);
    const resultat = await this.comptes.renvoyerCodeInscription(corps.email, ip);
    return { donnees: resultat };
  }

  @Post("connexion")
  @ApiOperation({
    summary: "Connexion d'un compte par adresse e-mail et mot de passe",
    description:
      "Les comptes antérieurs, sans mot de passe, continuent de passer par " +
      "`/comptes/otp/envoyer` puis `/comptes/otp/verifier`. Renvoie 403 " +
      "`COMPTE_NON_VERIFIE` quand le mot de passe est bon mais l'adresse non confirmée.",
  })
  async connexion(
    @Body() corps: ConnexionMotDePasseDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const ip = extraireIpClientSecurisee(req);
    const resultat = await this.comptes.connexionMotDePasse(corps.email, corps.motDePasse, ip);
    this.poserCookieSession(resultat.token, res);
    return { donnees: resultat };
  }

  /**
   * Pose le cookie de session sur la réponse.
   *
   * Les trois routes qui ouvrent une session posaient chacune leur copie de ces
   * options. Une seule suffit : le jour où `sameSite` ou la durée change, il n'y
   * a qu'un endroit à corriger, et aucune route ne reste en arrière.
   */
  private poserCookieSession(token: string | undefined, res?: Response) {
    if (!token || !res?.cookie) return;
    res.cookie("teranga_visiteur", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TRENTE_JOURS_MS,
    });
  }

  @Post("prestataire/connexion")
  @ApiOperation({ summary: "Connexion prestataire par SMS" })
  async prestataire(
    @Body() corps: ConnexionPrestataireDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const resultat = await this.comptes.connexionPrestataire(corps.telephone, corps.code);

    if (resultat.token && res?.cookie) {
      res.cookie("teranga_prestataire", resultat.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TRENTE_JOURS_MS,
      });
    }

    return { donnees: resultat };
  }

  @Post("deconnexion")
  @ApiOperation({ summary: "Révoquer la session active et effacer les cookies" })
  @ApiHeader({ name: "x-visiteur-id", required: false })
  @ApiHeader({ name: "authorization", required: false })
  async deconnecter(
    @Headers("x-visiteur-id") visiteurHeader?: string,
    @Headers("authorization") authHeader?: string,
    @Headers("cookie") cookieHeader?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const token = extraireJetonRequete(visiteurHeader, authHeader, cookieHeader);
    if (token) {
      await this.comptes.deconnecter(token);
    }

    if (res?.clearCookie) {
      res.clearCookie("teranga_visiteur", { path: "/" });
      res.clearCookie("teranga_prestataire", { path: "/" });
    }

    return { donnees: { deconnecte: true } };
  }
}
