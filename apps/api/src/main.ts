import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { FiltreExceptions } from "./commun/filtres/filtre-exceptions";
import { config } from "./config/configuration";

async function demarrer() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });

  // Le site envoie son cookie de session : l'origine est donc contrôlée,
  // jamais ouverte à tout le monde.
  app.enableCors({ origin: config.originesAutorisees, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // un champ non déclaré est retiré
      forbidNonWhitelisted: true, // …et refusé, plutôt qu'ignoré en silence
      transform: true,
    }),
  );
  app.useGlobalFilters(new FiltreExceptions());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Teranga Way — API")
      .setDescription(
        "Logements et transports vérifiés pour les JOJ Dakar 2026. " +
          "Aucun paiement en ligne : le paiement a lieu sur place.",
      )
      .setVersion("0.1.0")
      .build(),
  );
  SwaggerModule.setup("documentation", app, document);

  await app.listen(config.port);
  new Logger("API").log(
    `à l'écoute sur http://localhost:${config.port} — documentation sur /documentation`,
  );
}

void demarrer();
