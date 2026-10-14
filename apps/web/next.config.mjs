/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Paquets de l'atelier publiés en TypeScript brut : Next les compile lui-même.
  transpilePackages: ["@teranga/ui", "@teranga/tokens", "@teranga/contracts"],
  devIndicators: false,
};

export default nextConfig;
