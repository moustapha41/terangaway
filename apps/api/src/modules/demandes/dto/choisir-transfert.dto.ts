import { ApiProperty } from "@nestjs/swagger";
import { CHOIX_TRANSFERT, type ChoixTransfert } from "@teranga/contracts";
import { IsIn, IsString, Length } from "class-validator";

/**
 * La réponse du visiteur à « voulez-vous qu'on vienne vous chercher à
 * l'aéroport ? ».
 */
export class ChoisirTransfertDto {
  @ApiProperty({ enum: CHOIX_TRANSFERT })
  @IsIn(CHOIX_TRANSFERT as unknown as string[])
  choix!: ChoixTransfert;

  @ApiProperty({
    description:
      "Le jeton remis à la création de la demande. Il n'autorise que cette réponse, " +
      "pour cette demande : sans lui, une référence devinée suffirait à écrire à un inconnu.",
  })
  @IsString()
  @Length(64, 64)
  jeton!: string;
}
