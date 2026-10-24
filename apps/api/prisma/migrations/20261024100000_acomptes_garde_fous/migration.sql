-- Garde-fous d'intégrité des acomptes, tenus par la base elle-même.
--
-- Migration **additive** : des contraintes CHECK et un déclencheur. Aucune table,
-- aucune colonne, aucune donnée n'est créée, modifiée ni supprimée.
--
-- Pourquoi la base, alors que le dépôt applique déjà ces règles : un dossier
-- d'acompte est un enregistrement d'argent. Le dépôt ne protège que les écritures
-- qui passent par lui ; un script, une console SQL ou une future route qui le
-- contournerait pourrait sinon déclarer « payé » un acompte qui n'a rien reçu,
-- réécrire un montant demandé, ou rouvrir un remboursement terminé. Ces règles
-- doublent celles du dépôt et ne les remplacent pas : le dépôt reste la première
-- ligne, avec de vrais messages d'erreur.
--
-- Le statut de la demande n'est pas concerné : un acompte et sa demande restent
-- deux cycles distincts.
--
-- Prérequis : aucune ligne existante ne doit les violer. La migration échoue
-- plutôt que de laisser passer — elle ne corrige rien en silence.

-- 1. Le statut doit dire la vérité sur les montants reçus.
ALTER TABLE "deposit_payments"
  ADD CONSTRAINT "deposit_payments_en_attente_check"
    CHECK ("statut" <> 'en_attente' OR "montantRecu" = 0),
  ADD CONSTRAINT "deposit_payments_partiel_check"
    CHECK ("statut" <> 'partiel' OR ("montantRecu" > 0 AND "montantRecu" < "montantAttendu")),
  ADD CONSTRAINT "deposit_payments_paye_check"
    CHECK ("statut" <> 'paye' OR "montantRecu" >= "montantAttendu"),
  ADD CONSTRAINT "deposit_payments_annule_check"
    CHECK ("statut" <> 'annule' OR "montantRecu" = 0);

-- 2. Une réception, une décision ou un remboursement ont un auteur et un montant.
--
-- Le système ne voit pas la banque : il ne peut ni constater une réception ni
-- vérifier un paiement. Un événement de ces types sans personne nommée, ou sans
-- montant, ne raconte rien de vérifiable.
ALTER TABLE "deposit_payment_events"
  ADD CONSTRAINT "deposit_payment_events_acteur_requis_check"
    CHECK ("type" NOT IN ('reception_confirmee', 'verification', 'remboursement_decide', 'remboursement_effectue')
           OR "acteurId" IS NOT NULL),
  ADD CONSTRAINT "deposit_payment_events_montant_requis_check"
    CHECK ("type" NOT IN ('reception_confirmee', 'remboursement_decide', 'remboursement_effectue')
           OR "montant" IS NOT NULL);

-- 3. Ce qui est figé à la préparation le reste ; les statuts suivent leur table.
--
-- Le taux, le total et le montant attendu sont ce qu'on a annoncé à quelqu'un :
-- ils ne se réécrivent pas. Le montant reçu ne diminue jamais — rendre de
-- l'argent se consigne au journal, pas en effaçant un cumul. Les passages de
-- statut permis sont ceux de `TRANSITIONS_ACOMPTE`
-- (apps/api/src/modules/acomptes/acomptes.depot.ts) ; un test compare les deux
-- tables pour qu'elles ne divergent pas. `rembourse` est final.
--
-- Rester sur le même statut est permis : une réception partielle de plus, ou un
-- versement tardif sur un acompte expiré, change le cumul sans changer d'état.
CREATE FUNCTION "deposit_payments_garde_fous"() RETURNS trigger AS $$
BEGIN
  IF NEW."demandeId" IS DISTINCT FROM OLD."demandeId"
     OR NEW."pourcentageApplique" <> OLD."pourcentageApplique"
     OR NEW."montantTotal" <> OLD."montantTotal"
     OR NEW."montantAttendu" <> OLD."montantAttendu"
     OR NEW."creeLe" <> OLD."creeLe" THEN
    RAISE EXCEPTION 'deposit_payments : la demande, le taux et les montants sont figés à la préparation'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."montantRecu" < OLD."montantRecu" THEN
    RAISE EXCEPTION 'deposit_payments : le montant reçu ne diminue pas (% vers %)', OLD."montantRecu", NEW."montantRecu"
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."statut" <> OLD."statut" THEN
    IF NOT (
      (OLD."statut" = 'en_attente'  AND NEW."statut" IN ('partiel', 'paye', 'expire', 'annule')) OR
      (OLD."statut" = 'partiel'     AND NEW."statut" IN ('paye', 'expire', 'annule', 'a_rembourser')) OR
      (OLD."statut" = 'paye'        AND NEW."statut" IN ('a_rembourser')) OR
      (OLD."statut" = 'expire'      AND NEW."statut" IN ('paye', 'a_rembourser')) OR
      (OLD."statut" = 'annule'      AND NEW."statut" IN ('a_rembourser')) OR
      (OLD."statut" = 'a_rembourser' AND NEW."statut" IN ('rembourse'))
    ) THEN
      RAISE EXCEPTION 'deposit_payments : passage de % à % interdit', OLD."statut", NEW."statut"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deposit_payments_garde_fous"
  BEFORE UPDATE ON "deposit_payments"
  FOR EACH ROW EXECUTE FUNCTION "deposit_payments_garde_fous"();
