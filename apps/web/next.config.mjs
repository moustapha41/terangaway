import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
