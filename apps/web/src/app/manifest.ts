import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application installable.
 *
 * « Application web installable » en V1 ; les versions des stores sont reportées
 * à cause des délais de validation externes (§D.1).
 *
 * `start_url` pointe sur `/`, pas sur `/fr` : le middleware détecte la langue au
 * lancement, comme pour une visite ordinaire. Figer la langue dans le manifeste
 * la figerait pour toujours sur l'appareil.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Teranga Way — Logements et transports vérifiés",
    short_name: "Teranga Way",
    description:
      "Trouvez des logements et des transports vérifiés pour les Jeux Olympiques de la Jeunesse de Dakar 2026.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#001d35",
    lang: "fr",
    dir: "ltr",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/icons/icone.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes demandes", url: "/fr/mes-demandes" },
      { name: "Aide", url: "/fr/aide" },
    ],
  };
}
