import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Entrées du parcours d'inscription.
 *
 * Les bornes posées ici sont une première barrière, pas la validation
 * définitive : `ServiceComptes.inscrire` revérifie tout, et c'est lui qui
 * tranche. Un DTO protège la route ; le service protège la règle.
 *
 * `MaxLength(200)` sur le mot de passe n'est pas une contrainte de politique
 * mais de coût : scrypt est volontairement lent, et un mot de passe d'un
 * mégaoctet serait un moyen gratuit de faire travailler le serveur.
 */
export class InscriptionDto {
  @ApiProperty({ example: "Rokhaya Seck" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nom!: string;

  @ApiProperty({ example: "rokhaya.seck@exemple.sn" })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "un mot de passe assez long",
    description: "Dix caractères au minimum. Jamais journalisé, jamais renvoyé.",
  })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  motDePasse!: string;
}

export class VerifierInscriptionDto {
  @ApiProperty({ example: "rokhaya.seck@exemple.sn" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "481502", description: "Code à six chiffres reçu par e-mail" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class RenvoyerCodeInscriptionDto {
  @ApiProperty({ example: "rokhaya.seck@exemple.sn" })
  @IsEmail()
  email!: string;
}

export class ConnexionMotDePasseDto {
  @ApiProperty({ example: "rokhaya.seck@exemple.sn" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "un mot de passe assez long" })
  @IsString()
  @MaxLength(200)
  motDePasse!: string;
}
