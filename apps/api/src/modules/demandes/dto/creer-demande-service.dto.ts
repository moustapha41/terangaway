import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SERVICES_A_LA_DEMANDE, type ServiceALaDemande } from "@teranga/contracts";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Une demande de service sans catalogue.
 *
 * `details` arrive tel que le formulaire l'a composé : ce sont les champs
 * déclarés par le service côté site, et ils changeront sans que l'API bouge.
 * On ne les typage donc pas champ par champ — mais on borne : un dictionnaire
 * de chaînes, pas un objet libre où l'on pourrait glisser n'importe quoi.
 */
export class CreerDemandeServiceDto {
  @ApiProperty({ enum: SERVICES_A_LA_DEMANDE })
  @IsIn(SERVICES_A_LA_DEMANDE as unknown as string[])
  service!: ServiceALaDemande;

  @ApiProperty({
    description: "La saisie du visiteur, champ par champ.",
    example: { date: "2026-11-02", personnes: "4", besoin: "accueil-aeroport" },
  })
  @IsObject()
  details!: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: "Code à usage unique, si la session n'est pas ouverte." })
  @IsOptional()
  @IsString()
  code?: string;
}
