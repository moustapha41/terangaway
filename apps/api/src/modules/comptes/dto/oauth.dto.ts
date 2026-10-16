import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Ce que le site transmet après avoir identifié quelqu'un chez Google.
 *
 * Aucun jeton Google n'arrive ici, et c'est voulu : le site a déjà échangé le
 * code contre l'identité, vérifié le destinataire, l'émetteur, l'échéance, le
 * `nonce`, et que l'adresse soit confirmée. L'API reçoit le résultat de cette
 * vérification, pas de quoi la refaire.
 *
 * Ce qui veut dire qu'**un appelant qui atteindrait cette route pourrait se
 * faire passer pour n'importe quelle adresse**. Elle n'est donc jamais publiée :
 * le service `api` de la pile n'expose son port que sur le réseau interne, et
 * `SECRET_OAUTH_INTERNE` ajoute une seconde barrière quand il est renseigné.
 */
export class OAuthGoogleDto {
  @ApiProperty({ example: "rokhaya.seck@gmail.com", description: "Adresse confirmée par Google." })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Rokhaya Seck", description: "Nom affiché du compte Google." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional({
    example: "117240…",
    description: "Identifiant Google stable de la personne. Journalisé, jamais affiché.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sub?: string;
}
