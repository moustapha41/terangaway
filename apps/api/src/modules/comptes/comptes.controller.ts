import { Body, Controller, Headers, Post, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { ErreurMetier } from "../../commun/erreurs";
import { extraireIpClientSecurisee } from "../../commun/securite/adresse-ip";
import { ConnexionPrestataireDto, EnvoyerOtpDto, VerifierOtpDto } from "./dto/otp.dto";
import { ServiceComptes } from "./comptes.service";

@ApiTags("comptes")
@Controller("comptes")
export class ControleurComptes {
  constructor(private readonly comptes: ServiceComptes) {}

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

    if (resultat.token && res?.cookie) {
      res.cookie("teranga_visiteur", resultat.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 3600 * 1000,
      });
    }

    return { donnees: resultat };
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
        maxAge: 8 * 3600 * 1000,
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
    @Res({ passthrough: true }) res?: Response,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, "") || visiteurHeader;
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
