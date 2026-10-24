import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/**
 * Une réception à constater.
 *
 * Le montant est celui que la personne a **lu sur le compte**. Le serveur ne
 * recalcule rien de ce qui a été reçu, mais il juge tout le reste : le reste
 * dû, l'écart, la concurrence, le statut de la demande.
 */
export class SaisirReceptionDto {
  @ApiProperty({ description: "Montant réellement reçu, en FCFA entiers." })
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  montant!: number;

  @ApiProperty({ description: "Le cumul reçu que l'écran affichait ; refusé s'il a changé." })
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  montantRecuAvant!: number;

  @ApiPropertyOptional({ description: "Référence relevée sur le relevé bancaire ou Mobile Money." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceTransaction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  commentaire?: string;

  @ApiPropertyOptional({ description: "Reconnaît un écart avec le reste dû ; exige un commentaire." })
  @IsOptional()
  @IsBoolean()
  ecartConfirme?: boolean;
}

export class DeciderPaiementTardifDto {
  @ApiProperty({ enum: ["accepter", "rembourser"] })
  @IsIn(["accepter", "rembourser"])
  issue!: "accepter" | "rembourser";

  @ApiProperty({ description: "Ce qui a été vérifié, la disponibilité surtout." })
  @IsString()
  @MaxLength(500)
  commentaire!: string;
}
