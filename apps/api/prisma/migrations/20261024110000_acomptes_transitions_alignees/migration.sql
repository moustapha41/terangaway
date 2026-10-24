-- Aligne la table des transitions d'acompte sur celle du dépôt.
--
-- Migration **additive** : elle remplace le corps d'une fonction de déclencheur.
-- Aucune table, aucune colonne, aucune donnée n'est touchée.
--
-- `20261024100000_acomptes_garde_fous` a posé la règle « un acompte annulé n'a
-- rien reçu ». Elle rendait deux passages contradictoires, que la première table
-- permettait encore :
--
--   partiel → annulé    un acompte qui a reçu de l'argent ne s'annule pas : il
--                       se rend (partiel → à rembourser) ;
--   annulé → à rembourser   un acompte annulé n'a rien à rendre.
--
-- Les deux sont retirés — du dépôt (`TRANSITIONS_ACOMPTE`) et d'ici. Un test
-- compare les deux tables sur les 42 changements de statut possibles.
--
-- Aucune ligne existante ne peut être concernée : le déclencheur ne s'exécute
-- que sur une écriture, et aucun passage retiré n'était réalisable sans violer
-- `deposit_payments_annule_check`.
CREATE OR REPLACE FUNCTION "deposit_payments_garde_fous"() RETURNS trigger AS $$
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
      (OLD."statut" = 'en_attente'   AND NEW."statut" IN ('partiel', 'paye', 'expire', 'annule')) OR
      (OLD."statut" = 'partiel'      AND NEW."statut" IN ('paye', 'expire', 'a_rembourser')) OR
      (OLD."statut" = 'paye'         AND NEW."statut" IN ('a_rembourser')) OR
      (OLD."statut" = 'expire'       AND NEW."statut" IN ('paye', 'a_rembourser')) OR
      (OLD."statut" = 'a_rembourser' AND NEW."statut" IN ('rembourse'))
    ) THEN
      RAISE EXCEPTION 'deposit_payments : passage de % à % interdit', OLD."statut", NEW."statut"
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
