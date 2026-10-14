"use client";

import { useEffect } from "react";
import { Bandeau, Bouton, Carte, Icone } from "@teranga/ui";
import { ASSISTANCE, telUrl } from "@/lib/assistance";
import { useT } from "@/lib/i18n/contexte";
import { Lien } from "@/lib/i18n/lien";

/**
 * Écran de panne des parcours visiteur — le cinquième état du §B.7.
 *
 * Il couvre tout le groupe : une page qui n'arrive pas à lire le catalogue
 * affiche ceci au lieu de disparaître. C'est un seul fichier plutôt qu'un
 * `try` dans chaque page, et surtout il attrape aussi ce qu'on n'a pas prévu.
 *
 * Trois sorties, parce qu'une impasse n'en est jamais une (§B.1) : réessayer,
 * revenir à l'accueil, ou appeler quelqu'un.
 */
export default function Panne({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error("[visiteur] page en panne", error);
  }, [error]);

  return (
    <main className="bg-page">
      <div className="mx-auto w-[87.5%] max-w-[560px] py-16">
        <Carte className="p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-teinte-jaune text-alerte">
            <Icone nom="alerte" taille={28} />
          </span>

          <h1 className="mt-5 text-titre-2 text-encre">{t("panne.titre")}</h1>
          <p className="mt-2 text-corps text-encre-douce">{t("panne.texte")}</p>

          <div className="mt-6 space-y-3">
            <Bouton variante="principal" largeur="pleine" onClick={reset}>
              {t("panne.reessayer")}
            </Bouton>
            <Lien href="/">
              <Bouton variante="secondaire" largeur="pleine">
                {t("panne.accueil")}
              </Bouton>
            </Lien>
          </div>

          <div className="mt-6 text-left">
            <Bandeau variante="information">
              <a href={telUrl} className="font-semibold underline underline-offset-2">
                {t("panne.appeler", { telephone: ASSISTANCE.telephone })}
              </a>
            </Bandeau>
          </div>

          {/* Le repère technique, discret : il permet de retrouver la trace. */}
          {error.digest && (
            <p className="mt-4 text-legende text-encre-douce chiffres-tabulaires">
              {error.digest}
            </p>
          )}
        </Carte>
      </div>
    </main>
  );
}
