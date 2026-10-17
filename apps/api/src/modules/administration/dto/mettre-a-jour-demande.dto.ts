import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  MOTIFS_REFUS,
  STATUTS_DEMANDE,
  type MotifRefus,
  type StatutDemande,
} from "@teranga/contracts";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

/**
 * Ce que l'équipe change sur une demande.
 *
 * Tout est facultatif : on envoie ce qu'on a modifié. `null` sur le prix ou le
 * prestataire efface ; absent laisse en l'état — la distinction compte, sans
 * quoi enregistrer une note effacerait la proposition chiffrée.
 */
export class MettreAJourDemandeDto {
  @ApiPropertyOptional({ enum: STATUTS_DEMANDE })
  @IsOptional()
  @IsIn(STATUTS_DEMANDE as unknown as string[])
  statut?: StatutDemande;

  @ApiPropertyOptional({ enum: MOTIFS_REFUS })
  @IsOptional()
  @IsIn(MOTIFS_REFUS as unknown as string[])
  motifRefus?: MotifRefus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsString()
  @MaxLength(64)
  prestataireId?: string | null;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  noteInterne?: string;

  @ApiPropertyOptional({ nullable: true, description: "En francs CFA." })
  @IsOptional()
  @ValidateIf((_, valeur) => valeur !== null)
  @IsInt()
  @Min(0)
  prixPropose?: number | null;
}
