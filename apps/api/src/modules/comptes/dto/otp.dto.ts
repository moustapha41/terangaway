import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class EnvoyerOtpDto {
  @ApiProperty({ example: "+221 77 000 00 00" })
  @IsString()
  @MinLength(9)
  telephone!: string;
}

export class VerifierOtpDto {
  @ApiProperty({ example: "+221 77 000 00 00" })
  @IsString()
  @MinLength(9)
  telephone!: string;

  @ApiProperty({ example: "123456" })
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
