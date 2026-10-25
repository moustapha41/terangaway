/**
 * Exporte le document OpenAPI généré par Nest/Swagger.
 *
 *   pnpm -F @teranga/api openapi
 */
import "reflect-metadata";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function exporter() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Teranga Way — API")
      .setDescription(
        "Logements et transports vérifiés pour les JOJ Dakar 2026. " +
          "Aucune passerelle de paiement en ligne : un éventuel acompte est réglé par virement ou Mobile Money " +
          "et vérifié manuellement par l'équipe.",
      )
      .setVersion("0.1.0")
      .build(),
  );

  const cible = resolve(__dirname, "../openapi.json");
  writeFileSync(cible, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI écrit dans ${cible}`);
}

void exporter();
