-- Mot de passe provisoire envoyé par e-mail à l'issue d'une demande.
--
-- Une demande s'envoie désormais sans code : le compte de contact est créé
-- avec un mot de passe que nous engendrons et expédions à l'adresse saisie.
-- Ce drapeau distingue ce mot de passe-là d'un mot de passe choisi, pour
-- qu'il ouvre la session alors même que l'adresse n'est pas encore vérifiée.
-- Il retombe à la première connexion.
ALTER TABLE "accounts" ADD COLUMN "motDePasseProvisoire" BOOLEAN NOT NULL DEFAULT false;
