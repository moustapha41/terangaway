-- Persistance des acomptes par virement bancaire (étape 2 du plan d'audit).
--
-- Migration **additive** : deux types, deux tables, aucune colonne touchée sur
-- les tables existantes. Elle ne réclame ni n'encaisse rien : un dossier
-- d'acompte n'est qu'un enregistrement, et rien ne l'écrit encore.
--
-- `deposit_payments`       un dossier par demande, au plus (`demandeId` unique).
-- `deposit_payment_events` le journal append-only de chaque dossier.

-- CreateEnum
CREATE TYPE "StatutAcompteDb" AS ENUM ('en_attente', 'partiel', 'paye', 'expire', 'annule', 'a_rembourser');

-- CreateEnum
CREATE TYPE "TypeEvenementAcompteDb" AS ENUM ('preparation', 'instructions_envoyees', 'rappel_envoye', 'preuve_declaree', 'verification', 'reception_confirmee', 'doublon_signale', 'anomalie_signalee', 'expiration_prononcee', 'annulation', 'remboursement_decide', 'remboursement_effectue');

-- CreateTable
CREATE TABLE "deposit_payments" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "statut" "StatutAcompteDb" NOT NULL DEFAULT 'en_attente',
    "pourcentageApplique" INTEGER NOT NULL,
    "montantTotal" INTEGER NOT NULL,
    "montantAttendu" INTEGER NOT NULL,
    "montantRecu" INTEGER NOT NULL DEFAULT 0,
    "echeanceLe" TIMESTAMP(3) NOT NULL,
    "instructionsEnvoyeesLe" TIMESTAMP(3),
    "rappeleLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_payment_events" (
    "id" TEXT NOT NULL,
    "acompteId" TEXT NOT NULL,
    "type" "TypeEvenementAcompteDb" NOT NULL,
    "statutAvant" "StatutAcompteDb",
    "statutApres" "StatutAcompteDb",
    "montant" INTEGER,
    "acteurId" TEXT,
    "referenceTransaction" TEXT,
    "commentaire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_payments_demandeId_key" ON "deposit_payments"("demandeId");

-- CreateIndex
CREATE INDEX "deposit_payments_statut_echeanceLe_idx" ON "deposit_payments"("statut", "echeanceLe");

-- CreateIndex
CREATE INDEX "deposit_payments_statut_creeLe_idx" ON "deposit_payments"("statut", "creeLe");

-- CreateIndex
CREATE INDEX "deposit_payment_events_acompteId_creeLe_idx" ON "deposit_payment_events"("acompteId", "creeLe");

-- AddForeignKey
ALTER TABLE "deposit_payments" ADD CONSTRAINT "deposit_payments_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payment_events" ADD CONSTRAINT "deposit_payment_events_acompteId_fkey" FOREIGN KEY ("acompteId") REFERENCES "deposit_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_payment_events" ADD CONSTRAINT "deposit_payment_events_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Garde-fous sur les montants, en francs CFA entiers.
--
-- Prisma ne sait pas les déclarer : ils vivent ici. Ils doublent les contrôles
-- du dépôt, pour qu'une écriture qui le contournerait — script, console SQL —
-- ne puisse pas non plus produire un acompte qui réclame zéro, plus que le
-- prix, ou un taux hors de ]0, 100].
ALTER TABLE "deposit_payments"
  ADD CONSTRAINT "deposit_payments_pourcentage_check"
    CHECK ("pourcentageApplique" > 0 AND "pourcentageApplique" <= 100),
  ADD CONSTRAINT "deposit_payments_montant_total_check"
    CHECK ("montantTotal" > 0),
  ADD CONSTRAINT "deposit_payments_montant_attendu_check"
    CHECK ("montantAttendu" > 0 AND "montantAttendu" <= "montantTotal"),
  ADD CONSTRAINT "deposit_payments_montant_recu_check"
    CHECK ("montantRecu" >= 0);

ALTER TABLE "deposit_payment_events"
  ADD CONSTRAINT "deposit_payment_events_montant_check"
    CHECK ("montant" IS NULL OR "montant" > 0);

-- Le journal est append-only, et la base le tient elle-même.
--
-- Une nouvelle étape est une nouvelle ligne ; une ligne écrite ne se corrige
-- pas, elle se contredit par une suivante. Sans ce déclencheur, la règle ne
-- tiendrait que par la discipline du code — et c'est précisément quand
-- quelqu'un la contourne qu'on a besoin de la piste d'audit.
--
-- `TRUNCATE` n'est pas concerné (pas de déclencheur de ligne) : il reste à la
-- main du propriétaire de la base pour remettre à zéro un poste de développement.
CREATE FUNCTION "deposit_payment_events_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'deposit_payment_events est append-only : % refusé', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deposit_payment_events_append_only"
  BEFORE UPDATE OR DELETE ON "deposit_payment_events"
  FOR EACH ROW EXECUTE FUNCTION "deposit_payment_events_append_only"();
