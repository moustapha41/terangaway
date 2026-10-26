"use client";

import { useState, useTransition } from "react";
import type { ChoixTransfert } from "@teranga/contracts";
import { Icone } from "@teranga/ui";
import { Lien } from "@/lib/i18n/lien";
import { useT } from "@/lib/i18n/contexte";
import { lienWhatsapp } from "@/lib/assistance";
import { choisirTransfertAction } from "./transfert";

/**
 * « Souhaitez-vous qu'on vienne vous chercher à l'aéroport ? »
 *
 * La question est posée une fois la demande de logement **partie** : elle est
 * déjà enregistrée, et ne dépend pas de la réponse. Ce n'est pas une étape de
 * plus à franchir pour l'envoyer, c'est une proposition faite à quelqu'un qui
 * vient de s'engager sur un pays qu'il ne connaît pas — et qui n'a pas encore
 * dit comment il y arrive.
 *
 * Chaque état dit une chose, et une seule :
 *
 *   la question — oui ou non, deux boutons de même poids ;
 *   le oui — c'est noté, et ce qui se passe maintenant. « Un e-mail de
 *     confirmation vous sera envoyé » n'est écrit que si l'e-mail est
 *     réellement parti ; sinon, c'est l'équipe qui le contactera ;
 *   le non — nous vous guiderons jusqu'au logement, et quand l'adresse arrive.
 *
 * Dans les deux cas, le visiteur peut revenir sur son choix : un clic de travers
 * ne doit pas l'enfermer dans une réponse.
 *
 * Le jeton qui autorise la réponse n'est pas ici : il vit côté serveur, dans un
 * cookie que le navigateur ne lit pas. Ce composant ne connaît que l'état.
 */
export function QuestionTransfert({
  lieu,
  jour,
  reference,
  lienVehicules,
  initial,
}: {
  /** Où l'on dépose : « Centre, Somone ». */
  lieu: string;
  /** Le jour d'arrivée, déjà composé dans la langue de la page. */
  jour: string;
  reference: string;
  /** La recherche de véhicule, déjà remplie, pour qui préfère choisir lui-même. */
  lienVehicules: string;
  initial: { transfert?: ChoixTransfert; emailEnvoye: boolean };
}) {
  const t = useT();
  const [choix, setChoix] = useState<ChoixTransfert | undefined>(initial.transfert);
  const [emailEnvoye, setEmailEnvoye] = useState(initial.emailEnvoye);
  const [erreur, setErreur] = useState<"serveur" | "indisponible" | null>(null);
  const [enCours, demarrer] = useTransition();

  const repondre = (reponse: ChoixTransfert) => {
    setErreur(null);
    demarrer(async () => {
      const resultat = await choisirTransfertAction(reponse);
      if (resultat.succes) {
        setChoix(resultat.transfert);
        setEmailEnvoye(resultat.emailEnvoye);
      } else {
        setErreur(resultat.erreur);
      }
    });
  };

  const messageErreur = erreur && (
    <div role="alert" className="mt-3 rounded-xl border border-danger/40 bg-teinte-rouge/40 px-3.5 py-2.5 text-[13px] leading-snug text-encre">
      <p>{erreur === "indisponible" ? t("transfert.indisponible") : t("transfert.erreur")}</p>
      {erreur === "indisponible" && (
        <a
          href={lienWhatsapp(t("whatsapp.transfert", { reference }))}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block font-semibold underline underline-offset-2"
        >
          {t("transfert.ecrireWhatsapp")}
        </a>
      )}
    </div>
  );

  const boutonChanger = (reponse: ChoixTransfert, libelle: string) => (
    <p className="mt-3 text-[12.5px] text-encre-douce">
      {t("transfert.changer")}{" "}
      <button
        type="button"
        onClick={() => repondre(reponse)}
        disabled={enCours}
        data-umami-event={reponse === "souhaite" ? "transfert-oui" : "transfert-non"}
        className="font-semibold text-primaire underline underline-offset-2 disabled:opacity-50"
      >
        {enCours ? t("transfert.enCours") : libelle}
      </button>
    </p>
  );

  /* ── Le oui ── */
  if (choix === "souhaite") {
    return (
      <section aria-live="polite" className="mt-5 rounded-2xl border border-succes/40 bg-teinte-vert/50 p-4 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-succes">
            <Icone nom="coche-cercle" taille={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-encre">{t("transfert.ouiTitre")}</h2>
            <p className="mt-1 text-[13.5px] leading-snug text-encre">
              {emailEnvoye ? t("transfert.ouiEmail") : t("transfert.ouiSansEmail")}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-succes/20 pt-3">
          <p className="text-[13px] text-encre-douce">{t("transfert.ouiVol")}</p>
          <a
            href={lienWhatsapp(t("whatsapp.transfert", { reference }))}
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="transfert-vol-whatsapp"
            className="mt-2 inline-flex h-[44px] items-center gap-2 rounded-pill bg-succes px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-succes"
          >
            <Icone nom="whatsapp" taille={20} />
            {t("transfert.ouiVolBouton")}
          </a>

          <p className="mt-3 text-[12.5px] text-encre-douce">
            {t("transfert.ouiVehicules")}{" "}
            <Lien
              href={lienVehicules}
              data-umami-event="transfert-choisir-vehicule"
              className="font-semibold text-primaire underline underline-offset-2"
            >
              {t("transfert.ouiVehiculesLien")}
            </Lien>
          </p>
        </div>

        {boutonChanger("refuse", t("transfert.changerNon"))}
        {messageErreur}
      </section>
    );
  }

  /* ── Le non ── */
  if (choix === "refuse") {
    return (
      <section aria-live="polite" className="mt-5 rounded-2xl border border-contour bg-surface p-4 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-primaire">
            <Icone nom="coche-cercle" taille={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-encre">{t("transfert.nonTitre")}</h2>
            <p className="mt-1 text-[13.5px] leading-snug text-encre-douce">{t("transfert.nonTexte")}</p>
          </div>
        </div>

        {boutonChanger("souhaite", t("transfert.changerOui"))}
        {messageErreur}
      </section>
    );
  }

  /* ── La question ── */
  return (
    <section aria-labelledby="transfert-question" className="mt-5 rounded-2xl border border-contour bg-surface p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-teinte-bleu text-primaire">
          <Icone nom="avion" taille={20} />
        </span>
        <div className="min-w-0">
          <h2 id="transfert-question" className="text-[15px] font-bold leading-snug text-encre">
            {t("transfert.questionTitre")}
          </h2>
          <p className="mt-1 text-[13px] leading-snug text-encre-douce">
            {t("transfert.questionTexte", { lieu, jour })}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => repondre("souhaite")}
          disabled={enCours}
          data-umami-event="transfert-oui"
          className="h-[46px] rounded-pill border border-transparent bg-primaire px-4 text-[14.5px] font-semibold text-white shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all hover:bg-[#072c4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire active:scale-[0.99] disabled:opacity-50"
        >
          {enCours ? t("transfert.enCours") : t("transfert.oui")}
        </button>
        <button
          type="button"
          onClick={() => repondre("refuse")}
          disabled={enCours}
          data-umami-event="transfert-non"
          className="h-[46px] rounded-pill border border-contour bg-surface px-4 text-[14.5px] font-semibold text-encre transition-colors hover:bg-champ focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire disabled:opacity-50"
        >
          {t("transfert.non")}
        </button>
      </div>

      {messageErreur}
    </section>
  );
}
