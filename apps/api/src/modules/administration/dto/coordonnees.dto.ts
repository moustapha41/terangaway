import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Les coordonnées saisies par l'équipe.
 *
 * Ce DTO ne tient que la forme commune — des textes bornés, aucun champ
 * inconnu (le `ValidationPipe` global refuse le reste). Les champs exigés
 * dépendent du genre de la réservation : c'est `validerCoordonnees` qui les
 * applique, une fois la demande lue.
 */
export class SaisirCoordonneesDto {
  @ApiPropertyOptional({ description: "Logement" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adresseExacte?: string;

  @ApiPropertyOptional({ description: "Logement" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  telephone?: string;

  @ApiPropertyOptional({ description: "Logement" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  consignesArrivee?: string;

  @ApiPropertyOptional({ description: "Véhicule" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  immatriculation?: string;

  @ApiPropertyOptional({ description: "Véhicule" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  telephoneChauffeur?: string;

  @ApiPropertyOptional({ description: "Véhicule" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lieuDeRendezVous?: string;
}

export class VerifierCoordonneesDto {
  @ApiProperty({
    description:
      "La date de la saisie que vous avez relue. Une saisie plus récente rend la vérification caduque.",
  })
  @IsISO8601()
  saisieLe!: string;
}
