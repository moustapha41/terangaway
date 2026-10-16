import { describe, it, expect } from "vitest";

import { resoudreDestination } from "../../src/features/compte/destination";

/**
 * La destination de retour après connexion ou vérification.
 *
 * `suite` arrive par l'URL : il est fourni par le navigateur, donc par
 * n'importe qui. Un lien `…/connexion?suite=https://sitemechant.example`
 * envoyé par e-mail ferait se connecter la personne pour de vrai sur Teranga
 * Way, puis l'enverrait sur une copie du site qui lui redemanderait ses
 * identifiants. C'est une redirection ouverte, et c'est ce que ces tests
 * ferment.
 */
describe("Destination de retour — rien ne sort du site", () => {
  it("refuse toute destination externe", () => {
    const externes = [
      "https://sitemechant.example",
      "http://sitemechant.example/connexion",
      "//sitemechant.example",
      "//sitemechant.example/compte",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "mailto:quelquun@exemple.sn",
      "sitemechant.example",
      "www.sitemechant.example/compte",
    ];

    for (const suite of externes) {
      // Tout ce qui n'est pas un chemin interne retombe sur la destination
      // par défaut, préfixée par la langue.
      expect(resoudreDestination(suite), suite).toBe("/fr/compte");
    }
  });

  it("refuse les antislashs, que les navigateurs normalisent en barres obliques", () => {
    // `/\serveur` devient `//serveur` dans plusieurs navigateurs, c'est-à-dire
    // une URL absolue. Le test naïf sur `//` ne l'attrape pas.
    for (const suite of ["/\\sitemechant.example", "\\\\sitemechant.example", "/compte\\..\\x"]) {
      expect(resoudreDestination(suite), suite).toBe("/fr/compte");
    }
  });

  it("refuse une valeur porteuse d'un saut de ligne", () => {
    // Un `\r\n` dans un en-tête `Location` permettrait d'en injecter un autre.
    for (const suite of ["/compte\r\nSet-Cookie: x=1", "/compte\nX: y"]) {
      expect(resoudreDestination(suite), JSON.stringify(suite)).toBe("/fr/compte");
    }
  });

  it("retombe sur l'espace compte quand il n'y a rien à honorer", () => {
    expect(resoudreDestination(undefined)).toBe("/fr/compte");
    expect(resoudreDestination(null)).toBe("/fr/compte");
    expect(resoudreDestination("")).toBe("/fr/compte");
    expect(resoudreDestination("   ")).toBe("/fr/compte");
  });

  it("conserve une destination interne et lui met le préfixe de langue", () => {
    expect(resoudreDestination("/compte/reservations")).toBe("/fr/compte/reservations");
    expect(resoudreDestination("/mes-demandes")).toBe("/fr/mes-demandes");
    expect(resoudreDestination("/demande/l-002?debut=2026-10-25&fin=2026-11-01")).toBe(
      "/fr/demande/l-002?debut=2026-10-25&fin=2026-11-01",
    );
  });

  it("ne double pas un préfixe de langue déjà présent", () => {
    expect(resoudreDestination("/fr/compte/reservations")).toBe("/fr/compte/reservations");
    expect(resoudreDestination("/en/compte", "en")).toBe("/en/compte");
    expect(resoudreDestination("/es/mes-demandes", "es")).toBe("/es/mes-demandes");
    expect(resoudreDestination("/fr")).toBe("/fr");
  });

  it("ne prend pas « /france » pour un chemin déjà préfixé", () => {
    // Le test naïf `startsWith("/fr")` répondait oui, et le chemin ressortait
    // sans préfixe de langue : la page tombait alors en 404.
    expect(resoudreDestination("/france")).toBe("/fr/france");
    expect(resoudreDestination("/enfants")).toBe("/fr/enfants");
    expect(resoudreDestination("/espaces-verts")).toBe("/fr/espaces-verts");
  });

  it("respecte la langue demandée pour le préfixe", () => {
    expect(resoudreDestination("/compte", "en")).toBe("/en/compte");
    expect(resoudreDestination("/compte", "es")).toBe("/es/compte");
    // Y compris sur la destination par défaut.
    expect(resoudreDestination("https://ailleurs.example", "en")).toBe("/en/compte");
  });
});
