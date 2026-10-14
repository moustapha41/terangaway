import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

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
    description: "Code OTP à six chiffres. Obligatoire tant qu'aucune session n'est active.",
    example: "123456",
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code?: string;
}
