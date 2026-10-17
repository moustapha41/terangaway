import { nomLisible, visiteurConnecte } from "@/features/compte/session";
import { EnTete } from "./en-tete";

/**
 * L'en-tête, qui sait qui est connecté.
 *
 * `EnTete` est un composant client — il lit le chemin courant pour souligner
 * l'onglet actif — et ne peut donc pas lire le cookie de session, qui est
 * `httpOnly` et ne sort jamais du serveur. Il reçoit le nom en propriété.
 *
 * Le laisser à la charge de chaque page a exactement produit ce qu'on pouvait
 * craindre : seul `/compte` passait la propriété, et partout ailleurs un
 * visiteur connecté se voyait proposer « Se connecter ». Ce composant lit la
 * session une fois et la passe ; les écrans posent `<EnTeteSession />` sans
 * avoir à y penser.
 *
 * Conséquence assumée : une page qui porte cet en-tête lit un cookie, donc se
 * rend à la demande. Une page servie depuis un cache statique ne peut pas, par
 * construction, afficher le nom de la personne qui la regarde.
 */
export async function EnTeteSession() {
  const visiteur = await visiteurConnecte();
  return <EnTete visiteur={visiteur ? nomLisible(visiteur.identifiant) : undefined} />;
}
