import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from "class-validator";
import { CATEGORIES_VEHICULE } from "@teranga/contracts";

const enListe = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    const brut = Array.isArray(value) ? value : String(value).split(",");
    return brut.map((v) => String(v).trim()).filter(Boolean);
  });

const enNombre = () =>
  Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)));

export class ChercherVehiculesDto {
  @ApiProperty({
    enum: ["trajet", "location", "taxi"],
    description: "Le besoin détermine l'offre exigée du véhicule.",
  })
  @IsIn(["trajet", "location", "taxi"])
  besoin!: "trajet" | "location" | "taxi";

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(1)
  passagers?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(0)
  bagages?: number;

  @ApiPropertyOptional({
    example: "2026-10-25T10:00",
    description: "Prise en charge souhaitée. Un trajet demandé trop tôt est refusé (`DELAI_TROP_COURT`).",
  })
  @IsOptional()
  @IsISO8601()
  quand?: string;

  @ApiPropertyOptional({ enum: CATEGORIES_VEHICULE, isArray: true })
  @IsOptional()
  @enListe()
  @IsIn(CATEGORIES_VEHICULE as readonly string[], { each: true })
  categories?: string[];

  @ApiPropertyOptional({ example: "Dakar" })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(0)
  prixMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(0)
  prixMax?: number;
}

export class EstimerTaxiDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(1)
  passagers?: number;
}
