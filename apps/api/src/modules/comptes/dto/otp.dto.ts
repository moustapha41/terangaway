import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class EnvoyerOtpDto {
  @ApiPropertyOptional({ example: "visiteur@example.com", description: "Adresse e-mail ou téléphone" })
  @IsOptional()
  @IsString()
  identifiant?: string;

  @ApiPropertyOptional({ example: "visiteur@example.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "+221 77 000 00 00" })
  @IsOptional()
  @IsString()
  telephone?: string;
}

export class VerifierOtpDto {
  @ApiPropertyOptional({ example: "visiteur@example.com", description: "Adresse e-mail ou téléphone" })
  @IsOptional()
  @IsString()
  identifiant?: string;

  @ApiPropertyOptional({ example: "visiteur@example.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "+221 77 000 00 00" })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiProperty({ example: "123456", description: "Code à 6 chiffres reçu" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class ConnexionPrestataireDto {
  @ApiProperty({ example: "+221 77 111 22 33" })
  @IsString()
  @MinLength(9)
  telephone!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class OuvrirLienDemandeDto {
  @ApiProperty({ description: "Jeton du lien reçu par e-mail (twl_…)" })
  @IsString()
  @MaxLength(100)
  jeton!: string;
}
