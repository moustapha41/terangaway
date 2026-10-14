import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { EQUIPEMENTS, TYPES_LOGEMENT } from "@teranga/contracts";

/** Une liste arrive dans l'URL soit répétée, soit séparée par des virgules. */
const enListe = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    const brut = Array.isArray(value) ? value : String(value).split(",");
    return brut.map((v) => String(v).trim()).filter(Boolean);
  });

const enNombre = () =>
  Transform(({ value }) =>
    value === undefined || value === "" ? undefined : Number(value),
  );

export class ChercherLogementsDto {
  @ApiPropertyOptional({ example: "Dakar" })
  @IsOptional()
  @IsString()
  ville?: string;

  @ApiPropertyOptional({ example: 2, description: "Capacité minimale demandée." })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(1)
  personnes?: number;

  @ApiPropertyOptional({ enum: TYPES_LOGEMENT, isArray: true })
  @IsOptional()
  @enListe()
  @IsIn(TYPES_LOGEMENT as readonly string[], { each: true })
  types?: string[];

  @ApiPropertyOptional({ enum: EQUIPEMENTS, isArray: true })
  @IsOptional()
  @enListe()
  @IsIn(EQUIPEMENTS as readonly string[], { each: true })
  equipements?: string[];

  @ApiPropertyOptional({ isArray: true, example: ["Ngor", "Almadies"] })
  @IsOptional()
  @enListe()
  @IsString({ each: true })
  quartiers?: string[];

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(0)
  prixMin?: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(0)
  prixMax?: number;

  @ApiPropertyOptional({
    enum: ["pertinence", "prix-croissant", "prix-decroissant", "capacite", "note"],
  })
  @IsOptional()
  @IsIn(["pertinence", "prix-croissant", "prix-decroissant", "capacite", "note"])
  tri?: "pertinence" | "prix-croissant" | "prix-decroissant" | "capacite" | "note";

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @enNombre()
  @IsInt()
  @Min(1)
  page?: number;
}
