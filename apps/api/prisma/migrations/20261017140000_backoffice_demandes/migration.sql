-- AlterTable : ce qu'une demande de service porte, et ce que l'équipe y ajoute.
ALTER TABLE "demands" ADD COLUMN     "service" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "noteInterne" TEXT,
ADD COLUMN     "prixPropose" INTEGER;

-- CreateIndex : les deux tris du backoffice, par statut et par genre.
CREATE INDEX "demands_statut_creeLe_idx" ON "demands"("statut", "creeLe");

-- CreateIndex
CREATE INDEX "demands_genre_creeLe_idx" ON "demands"("genre", "creeLe");
