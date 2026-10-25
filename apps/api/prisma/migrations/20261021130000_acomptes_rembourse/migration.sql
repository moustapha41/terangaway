-- Acomptes : le remboursement effectué, et l'échec d'envoi des instructions.
--
-- Migration **additive** : deux valeurs d'énumération, rien d'autre.
--
-- `rembourse` est le statut final d'un acompte rendu. Il ne se pose qu'au vu
-- de l'exécution du remboursement, constatée par une personne : décider de
-- rembourser (`a_rembourser`) n'est pas avoir remboursé.
--
-- `envoi_echoue` consigne au journal des instructions de virement qui ne sont
-- pas parties. Le confondre avec `anomalie_signalee` mêlerait une panne de
-- messagerie et un écart d'argent dans la même file de traitement.
ALTER TYPE "StatutAcompteDb" ADD VALUE 'rembourse';
ALTER TYPE "TypeEvenementAcompteDb" ADD VALUE 'envoi_echoue';
