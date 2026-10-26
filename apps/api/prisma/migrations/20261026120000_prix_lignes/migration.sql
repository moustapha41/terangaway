-- La décomposition du prix d'un séjour, figée avec son total.
--
-- Le backoffice doit dire ce que le visiteur a choisi — « 2 semaines × 650 000 F »
-- — et non seulement un total. Recalculer ce détail à la lecture, d'après le
-- catalogue, le ferait diverger du total dès qu'un tarif change : il est donc
-- écrit à la création, avec lui.
--
-- Nullable : les demandes déjà en base n'en ont pas, et ne s'en voient pas
-- reconstituer un — le backoffice dit que le détail n'a pas été conservé.
ALTER TABLE "demands" ADD COLUMN "prixLignes" JSONB;
