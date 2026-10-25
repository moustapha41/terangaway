-- Le statut d'un acompte doit toujours s'expliquer par une ligne de son journal.
--
-- Migration **additive** : une fonction et un déclencheur de contrainte. Aucune
-- table, aucune colonne, aucune donnée n'est créée, modifiée ni supprimée. Les
-- lignes existantes ne sont pas revalidées : le déclencheur ne s'exécute que sur
-- une écriture nouvelle.
--
-- Pourquoi : `20261024100000_acomptes_garde_fous` interdit les montants et les
-- passages de statut incohérents, mais rien n'empêchait un statut d'être posé
-- sans trace — un acompte « payé » sans que personne n'ait constaté ni vérifié
-- quoi que ce soit, ou « remboursé » sans constat. Le dépôt écrit toujours le
-- statut et son événement dans la même transaction ; un script, une console SQL
-- ou une future route qui le contournerait, non. La piste d'audit ne vaut que si
-- on ne peut pas la contourner.
--
-- La vérification est **différée à la fin de la transaction** (`DEFERRABLE
-- INITIALLY DEFERRED`) : le dépôt écrit le statut puis l'événement, dans cet
-- ordre, et l'ordre ne doit pas compter. Si l'événement manque au `COMMIT`, toute
-- la transaction est annulée — statut compris.
--
-- Un dossier naît « en attente » : sa préparation est son seul événement, et ce
-- statut n'en exige pas d'autre. Rester sur le même statut (une réception de plus
-- sur un acompte partiel ou expiré) n'exige rien non plus.
--
-- Un acompte `expire` n'a, aujourd'hui, aucun écrivain en production : le seul
-- événement qui l'explique est `expiration_prononcee`, déjà réservé à ce passage.
CREATE FUNCTION "deposit_payments_journal_coherent"() RETURNS trigger AS $$
DECLARE
  types_attendus text[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."statut" = OLD."statut" THEN
    RETURN NULL;
  END IF;
  IF NEW."statut" = 'en_attente' THEN
    RETURN NULL;
  END IF;

  types_attendus := CASE NEW."statut"::text
    WHEN 'partiel'      THEN ARRAY['reception_confirmee']
    WHEN 'paye'         THEN ARRAY['reception_confirmee', 'verification']
    WHEN 'expire'       THEN ARRAY['expiration_prononcee']
    WHEN 'annule'       THEN ARRAY['annulation']
    WHEN 'a_rembourser' THEN ARRAY['remboursement_decide', 'annulation']
    WHEN 'rembourse'    THEN ARRAY['remboursement_effectue']
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM "deposit_payment_events" e
    WHERE e."acompteId" = NEW."id"
      AND e."statutApres" = NEW."statut"
      AND e."type"::text = ANY (types_attendus)
  ) THEN
    RAISE EXCEPTION 'deposit_payments : le statut « % » n''a pas son événement de journal (%)',
      NEW."statut", array_to_string(types_attendus, ' ou ')
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "deposit_payments_journal_coherent"
  AFTER INSERT OR UPDATE ON "deposit_payments"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "deposit_payments_journal_coherent"();
