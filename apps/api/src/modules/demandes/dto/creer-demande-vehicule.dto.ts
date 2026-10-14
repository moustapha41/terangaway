import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
} from "class-validator";

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

  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code?: string;
}
