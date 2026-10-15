-- CreateEnum
CREATE TYPE "RoleCompte" AS ENUM ('VISITEUR', 'PRESTATAIRE', 'ADMINISTRATEUR');

-- CreateEnum
CREATE TYPE "TypeCompte" AS ENUM ('LOGEMENT', 'TRANSPORT', 'LES_DEUX', 'VISITEUR');

-- CreateEnum
CREATE TYPE "StatutDemandeDb" AS ENUM ('envoyee', 'acceptee', 'confirmee', 'terminee', 'refusee', 'expiree', 'annulee');

-- CreateEnum
CREATE TYPE "GenreOffreDb" AS ENUM ('logement', 'trajet', 'location', 'taxi', 'service');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "nom" TEXT,
    "role" "RoleCompte" NOT NULL DEFAULT 'VISITEUR',
    "typeCompte" "TypeCompte" NOT NULL DEFAULT 'VISITEUR',
    "estVerifie" BOOLEAN NOT NULL DEFAULT false,
    "verifieLe" TIMESTAMP(3),
    "charteSigneeLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "finalite" TEXT NOT NULL DEFAULT 'connexion',
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "accountId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "visiteurId" TEXT NOT NULL,
    "prestataireId" TEXT,
    "genre" "GenreOffreDb" NOT NULL,
    "statut" "StatutDemandeDb" NOT NULL DEFAULT 'envoyee',
    "offreId" TEXT,
    "offreTitre" TEXT NOT NULL,
    "offreVignette" TEXT,
    "dateDebut" TEXT,
    "dateFin" TEXT,
    "personnes" INTEGER NOT NULL DEFAULT 1,
    "heureArrivee" TEXT,
    "lieuDepart" TEXT,
    "lieuArrivee" TEXT,
    "prestationTransport" TEXT,
    "bagages" INTEGER,
    "vol" TEXT,
    "message" TEXT,
    "prixUnitaire" INTEGER NOT NULL DEFAULT 0,
    "nuits" INTEGER,
    "fraisFixes" JSONB,
    "prixTotal" INTEGER NOT NULL DEFAULT 0,
    "coordonnees" JSONB,
    "frise" JSONB NOT NULL,
    "expireLe" TIMESTAMP(3),
    "motifRefus" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_response_tokens" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "prestataireId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "reponse" TEXT,
    "motifRefus" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_response_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_telephone_key" ON "accounts"("telephone");

-- CreateIndex
CREATE INDEX "accounts_role_idx" ON "accounts"("role");

-- CreateIndex
CREATE INDEX "otp_challenges_destination_creeLe_idx" ON "otp_challenges"("destination", "creeLe");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_accountId_idx" ON "sessions"("accountId");

-- CreateIndex
CREATE INDEX "sessions_tokenHash_idx" ON "sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "demands_reference_key" ON "demands"("reference");

-- CreateIndex
CREATE INDEX "demands_visiteurId_statut_idx" ON "demands"("visiteurId", "statut");

-- CreateIndex
CREATE INDEX "demands_prestataireId_statut_idx" ON "demands"("prestataireId", "statut");

-- CreateIndex
CREATE INDEX "demands_reference_idx" ON "demands"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "provider_response_tokens_tokenHash_key" ON "provider_response_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "provider_response_tokens_demandeId_idx" ON "provider_response_tokens"("demandeId");

-- CreateIndex
CREATE INDEX "provider_response_tokens_prestataireId_idx" ON "provider_response_tokens"("prestataireId");

-- CreateIndex
CREATE INDEX "provider_response_tokens_tokenHash_idx" ON "provider_response_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_visiteurId_fkey" FOREIGN KEY ("visiteurId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_response_tokens" ADD CONSTRAINT "provider_response_tokens_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_response_tokens" ADD CONSTRAINT "provider_response_tokens_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
