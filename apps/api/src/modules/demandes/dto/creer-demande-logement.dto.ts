import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { ContactDemandeDto } from "./contact-demande.dto";

export class CreerDemandeLogementDto {
  @ApiProperty({ example: "l-001" })
  @IsString()
  @MinLength(1)
  logementId!: string;

  @ApiProperty({ example: "2026-10-12" })
  @IsISO8601()
  debut!: string;

  @ApiProperty({ example: "2026-10-26" })
  @IsISO8601()
  fin!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(20)
  personnes!: number;

  @ApiPropertyOptional({ example: "15:00" })
  @IsOptional()
  @IsString()
  heureArrivee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
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
