import { lienTransfert } from "@teranga/contracts";
import { Icone, type NomIcone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import type { Traducteur } from "@/lib/i18n/traducteur";

/**
 * La suite du séjour : l'arrivée, ce qui se passe sur place, le retour.
 *
 * Une demande de logement envoyée, le visiteur n'a rien devant lui — l'écran
 * dit « c'est parti » et le laisse repartir. C'est le moment où il est le plus
 * disposé à penser au reste : il vient de s'engager sur un pays qu'il ne
 * connaît pas, et il lui manque encore la façon d'y arriver.
 *
 * C'est aussi ce qu'une plateforme qui ne vend que des chambres ne peut pas
 * faire. Elle ne propose pas d'être là à l'arrivée, ni d'être joignable quand
 * la climatisation tombe en panne à 23 h. Ici, c'est tout ce que le catalogue
 * contient déjà — véhicules, services — rangé dans l'ordre où le visiteur en
 * aura besoin.
 *
 * Rien n'est imposé : trois chemins, aucun n'est la suite obligée de la
 * demande, et le texte le dit. Les adresses viennent des contrats, les mêmes
 * que celles de la fiche et de l'e-mail — un visiteur arrivé par l'une doit
 * retrouver le trajet que l'autre lui annonçait.
 *
 * Chaque chemin porte un événement de mesure : savoir lequel est suivi vaut
 * mieux que le supposer.
 */
export function SuiteDuSejour({
  t,
  lieu,
  debut,
  fin,
  personnes,
}: {
  t: Traducteur;
  /** Le lieu du logement, tel que `lieuDeSejour` le nomme. */
  lieu: string;
  debut: string;
  fin: string;
  personnes: number;
}) {
  const chemins: Array<{
    cle: string;
    icone: NomIcone;
    titre: string;
    texte: string;
    href: string;
    evenement: string;
  }> = [
    {
      cle: "arrivee",
      icone: "avion",
      titre: t("confirmation.arriveeTitre"),
      texte: t("confirmation.arriveeTexte", { lieu }),
      href: lienTransfert({ sens: "arrivee", lieu, debut, fin, personnes }),
      evenement: "suite-arrivee",
    },
    {
      cle: "sejour",
      icone: "guide",
      titre: t("confirmation.sejourTitre"),
      texte: t("confirmation.sejourTexte"),
      href: "/services",
      evenement: "suite-sejour",
    },
    {
      cle: "depart",
      icone: "voiture",
      titre: t("confirmation.departTitre"),
      texte: t("confirmation.departTexte", { lieu }),
      href: lienTransfert({ sens: "depart", lieu, debut, fin, personnes }),
      evenement: "suite-depart",
    },
  ];

  return (
    <section aria-labelledby="suite-titre" className="mt-6 text-left sm:mt-7">
      <h2 id="suite-titre" className="text-[15px] font-bold text-encre">
        {t("confirmation.suiteTitre")}
      </h2>
      <p className="mt-0.5 text-[12.5px] text-encre-douce">{t("confirmation.suiteTexte")}</p>

      <ul className="mt-3 space-y-2">
        {chemins.map((chemin) => (
          <li key={chemin.cle}>
            <Lien
              href={chemin.href}
              data-umami-event={chemin.evenement}
              className="group flex items-center gap-3 rounded-[14px] border border-contour-champ bg-surface/70 px-3.5 py-3 transition-colors hover:border-primaire/40 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-teinte-bleu text-primaire">
                <Icone nom={chemin.icone} taille={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-encre">{chemin.titre}</span>
                <span className="block text-[12.5px] leading-snug text-encre-douce">
                  {chemin.texte}
                </span>
              </span>
              <Icone
                nom="chevron-droite"
                taille={20}
                className="shrink-0 text-encre-douce transition-transform group-hover:translate-x-0.5"
              />
            </Lien>
          </li>
        ))}
      </ul>
    </section>
  );
}
