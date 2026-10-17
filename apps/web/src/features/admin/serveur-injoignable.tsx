import { Bandeau, Carte } from "@teranga/ui";
import type { Langue } from "@/lib/i18n/langues";
import { traducteurPour } from "@/lib/i18n/messages";

/**
 * Ce que l'écran montre quand l'API ne répond pas.
 *
 * Renvoyer vers la connexion serait plus simple à écrire, et faux : l'équipe
 * retaperait un code pour un serveur éteint. On distingue donc les deux refus
 * — session invalide d'un côté, serveur injoignable de l'autre — parce que ce
 * ne sont pas les mêmes gestes qui les réparent.
 */
export function ServeurInjoignable({ langue }: { langue: Langue }) {
  const t = traducteurPour(langue);

  return (
    <Carte className="p-6">
      <h1 className="text-titre-2 text-encre">{t("admin.serveurTitre")}</h1>
      <div className="mt-4">
        <Bandeau variante="erreur">{t("admin.serveurTexte")}</Bandeau>
      </div>
      {/* Un lien, pas un bouton : recharger la page est exactement ce qu'il
          faut, et cela marche sans JavaScript. */}
      <a
        href={`/${langue}/admin`}
        className="mt-4 inline-flex min-h-[var(--size-control)] items-center rounded-control bg-primaire px-4 text-bouton text-white hover:bg-primaire-fonce"
      >
        {t("admin.reessayer")}
      </a>
    </Carte>
  );
}
