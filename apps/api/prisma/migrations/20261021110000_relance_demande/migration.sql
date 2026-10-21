-- Relance de l'équipe sur une demande qui approche de son échéance.
--
-- Le veilleur parcourt les demandes « envoyée » dont le délai de réponse
-- touche à sa fin et prévient l'équipe une fois. Cette colonne retient ce
-- « une fois » : sans elle, la même demande repartirait à chaque passage,
-- et une alerte qui se répète toutes les cinq minutes finit en filtre.
ALTER TABLE "demands" ADD COLUMN "relanceeLe" TIMESTAMP(3);
