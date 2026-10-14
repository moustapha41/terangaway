import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ConnexionPrestataireDto, EnvoyerOtpDto, VerifierOtpDto } from "./dto/otp.dto";
import { ServiceComptes } from "./comptes.service";

@ApiTags("comptes")
@Controller("comptes")
export class ControleurComptes {
  constructor(private readonly comptes: ServiceComptes) {}

  @Post("otp/envoyer")
  @ApiOperation({ summary: "Envoyer un code OTP au visiteur (simulé)" })
  async envoyer(@Body() corps: EnvoyerOtpDto) {
    const resultat = await this.comptes.envoyerOtp(corps.telephone);
    return { donnees: resultat };
  }

  @Post("otp/verifier")
  @ApiOperation({ summary: "Vérifier le code OTP et ouvrir une session visiteur" })
  async verifier(@Body() corps: VerifierOtpDto) {
    const resultat = await this.comptes.verifierOtp(corps.telephone, corps.code);
    return { donnees: resultat };
  }

  @Post("prestataire/connexion")
  @ApiOperation({ summary: "Connexion prestataire par SMS" })
  async prestataire(@Body() corps: ConnexionPrestataireDto) {
    const resultat = await this.comptes.connexionPrestataire(corps.telephone, corps.code);
    return { donnees: resultat };
  }
}
