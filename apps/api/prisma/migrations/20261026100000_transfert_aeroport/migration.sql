-- Le choix du transfert depuis l'aéroport, posé sur la demande de logement.
--
-- Une fois la demande partie, l'écran de confirmation demande au visiteur s'il
-- veut qu'on vienne le chercher. Sa réponse est rangée ici : sans trace, un
-- « oui » ne déclencherait ni e-mail de confirmation ni appel de l'équipe, et un
-- « non » ne dirait pas qu'il faut le guider jusqu'au logement.
--
-- `NULL` = pas encore répondu. La contrainte ferme la porte à toute autre valeur
-- que celles que l'API écrit : une faute de frappe dans un script ne doit pas
-- créer un troisième état que rien ne sait lire.
ALTER TABLE "demands" ADD COLUMN "transfertAeroport" TEXT;
ALTER TABLE "demands" ADD COLUMN "transfertChoisiLe" TIMESTAMP(3);

ALTER TABLE "demands"
  ADD CONSTRAINT "demands_transfert_valeurs"
  CHECK ("transfertAeroport" IS NULL OR "transfertAeroport" IN ('souhaite', 'refuse'));
