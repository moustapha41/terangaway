import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Les coordonnées portées par une demande envoyée sans compte.
 *
 * Une demande n'ouvre aucun accès : elle dépose un message chez un
 * propriétaire. Exiger un code à six chiffres pour l'envoyer faisait
 * abandonner le parcours à l'endroit même où il devait aboutir — l'adresse
 * suffit donc, et elle n'est pas présentée comme vérifiée pour autant.
 *
 * Le nom et le numéro ne servent qu'à rappeler la personne : sans eux,
 * l'équipe reçoit une demande qu'elle ne sait pas comment honorer.
 */
export class ContactDemandeDto {
  @ApiProperty({ example: "visiteur@exemple.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: "Rokhaya Seck" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional({ example: "+221 77 000 00 00" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telephone?: string;
}
