import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { SERVICES_A_LA_DEMANDE, type ServiceALaDemande } from "@teranga/contracts";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { ContactDemandeDto } from "./contact-demande.dto";

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

  @ApiPropertyOptional({
    type: ContactDemandeDto,
    description:
      "Coordonnées du visiteur, quand aucune session n'est ouverte. Plus de code à saisir : " +
      "l'adresse rattache la demande, elle ne vaut pas identité.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDemandeDto)
  contact?: ContactDemandeDto;
}
