import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
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

export class CreerDemandeVehiculeDto {
  @ApiProperty({ example: "v-001" })
  @IsString()
  @MinLength(1)
  vehiculeId!: string;

  @ApiProperty({ enum: ["trajet", "journee", "taxi"] })
  @IsIn(["trajet", "journee", "taxi"])
  prestation!: "trajet" | "journee" | "taxi";

  @ApiProperty({ example: "Aéroport AIBD" })
  @IsString()
  @MinLength(1)
  depart!: string;

  @ApiPropertyOptional({ example: "Plateau" })
  @IsOptional()
  @IsString()
  arrivee?: string;

  @ApiProperty({ example: "2026-10-12T10:00:00" })
  @IsISO8601()
  quand!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(14)
  passagers!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(14)
  bagages!: number;

  @ApiPropertyOptional({ example: "SN 1234" })
  @IsOptional()
  @IsString()
  vol?: string;

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
