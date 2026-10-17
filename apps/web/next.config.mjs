import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Où Next écrit sa sortie. `.next` par défaut, comme toujours.
   *
   * La variable existe pour une raison précise : `next build` et `next dev`
   * écrivent au même endroit, et une construction lancée pendant qu'un serveur
   * de développement tourne remplace ses chunks sous ses pieds. L'écran
   * affiche alors « __webpack_modules__[moduleId] is not a function », qui ne
   * dit rien de la cause. `NEXT_DIST_DIR=.next-build pnpm build` laisse le
   * serveur tranquille.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Paquets de l'atelier publiés en TypeScript brut : Next les compile lui-même.
  transpilePackages: ["@teranga/ui", "@teranga/tokens", "@teranga/contracts", "@teranga/fixtures"],
  devIndicators: false,
  // Sortie autonome pour l'image Docker : Next rassemble le serveur et les
  // seules dépendances qu'il a réellement tracées. Sans cela, il faudrait
  // embarquer tout le node_modules du dépôt.
  output: "standalone",
  // Le traçage doit partir de la racine du dépôt, sinon les paquets de
  // l'atelier — liés par pnpm hors de apps/web — sont oubliés.
  outputFileTracingRoot: join(ici, "../.."),
  experimental: {
    serverActions: {
      /**
       * Les domaines d'où une Server Action est acceptée.
       *
       * Next compare l'en-tête `Origin` de la requête à l'hôte qu'il croit
       * servir, et **refuse silencieusement** l'action quand les deux diffèrent
       * — c'est une protection contre les requêtes forgées depuis un autre
       * site. Derrière un mandataire, l'hôte vu par le conteneur n'est pas
       * celui vu par le visiteur : si le mandataire ne transmet pas
       * `x-forwarded-host`, toute connexion échoue sans un mot à l'écran.
       *
       * La liste est figée à la construction, comme tout ce que lit ce
       * fichier. Un domaine de plus demande une reconstruction de l'image.
       */
      allowedOrigins: (
        process.env.ORIGINES_ACTIONS ??
        "teranga-way.com,www.teranga-way.com,localhost:3000,localhost:3100"
      )
        .split(",")
        .map((origine) => origine.trim())
        .filter(Boolean),
    },
  },
};

export default nextConfig;
