import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MOTIFS_REFUS } from "@teranga/contracts";
import { IsIn, IsOptional, IsString } from "class-validator";

export class RepondreDto {
  @ApiProperty({ enum: ["acceptee", "refusee", "indisponible"] })
  @IsIn(["acceptee", "refusee", "indisponible"])
  reponse!: "acceptee" | "refusee" | "indisponible";

  @ApiPropertyOptional({ enum: MOTIFS_REFUS })
  @IsOptional()
  @IsIn([...MOTIFS_REFUS])
  motif?: (typeof MOTIFS_REFUS)[number];
}

/** Paramètre de route — documenté pour OpenAPI. */
export class JetonParamDto {
  @ApiProperty({ example: "demo-valide" })
  @IsString()
  jeton!: string;
}
