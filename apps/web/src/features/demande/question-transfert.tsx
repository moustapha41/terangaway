"use client";

import { useEffect, useState, useTransition } from "react";
import type { ChoixTransfert } from "@teranga/contracts";
import { FeuilleBasse, Icone } from "@teranga/ui";
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
 * Elle s'affiche **deux fois, sur un seul état** :
 *
 *   en popup, qui s'ouvre d'elle-même au-dessus de la page : c'est ce qui la
 *   fait remarquer, là où une carte parmi d'autres se lit en diagonale ;
 *
 *   en carte dans la page, qui reste : on peut fermer le popup sans répondre, et
 *   la question l'attend alors à sa place ; une fois répondu, la carte garde la
 *   réponse et permet d'en changer.
 *
 * Chaque état dit une chose, et une seule :
 *
 *   la question — oui ou non, deux boutons de même poids ;
 *   le oui — c'est noté, et ce qui se passe maintenant. « Un e-mail de
 *     confirmation vous sera envoyé » n'est écrit que si l'e-mail est
 *     réellement parti ; sinon, c'est l'équipe qui le contactera ;
 *   le non — nous vous guiderons jusqu'au logement, et quand l'adresse arrive.
 *
 * Le jeton qui autorise la réponse n'est pas ici : il vit côté serveur, dans un
 * cookie que le navigateur ne lit pas. Ces composants ne connaissent que l'état.
 */

interface Etat {
  choix: ChoixTransfert | undefined;
  emailEnvoye: boolean;
  enCours: boolean;
  erreur: "serveur" | "indisponible" | null;
  repondre: (reponse: ChoixTransfert) => void;
}

interface Contexte {
  lieu: string;
  jour: string;
  reference: string;
  lienVehicules: string;
}

/** Le popup ne se rouvre pas, dans une même visite, pour qui l'a déjà fermé. */
const cleFermeture = (reference: string) => `teranga_transfert_ferme:${reference}`;

export function TransfertSejour({
  lieu,
  jour,
  reference,
  lienVehicules,
  initial,
}: Contexte & {
  initial: { transfert?: ChoixTransfert; emailEnvoye: boolean };
}) {
  const t = useT();
  const contexte: Contexte = { lieu, jour, reference, lienVehicules };

  const [choix, setChoix] = useState<ChoixTransfert | undefined>(initial.transfert);
  const [emailEnvoye, setEmailEnvoye] = useState(initial.emailEnvoye);
  const [erreur, setErreur] = useState<Etat["erreur"]>(null);
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);

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

  const etat: Etat = { choix, emailEnvoye, enCours, erreur, repondre };

  // Le popup s'ouvre à l'arrivée sur la page — après le premier rendu, jamais
  // dans le HTML du serveur —, tant que la question n'a pas de réponse et que le
  // visiteur ne l'a pas déjà écartée pendant cette visite.
  useEffect(() => {
    if (initial.transfert) return;
    try {
      if (sessionStorage.getItem(cleFermeture(reference))) return;
    } catch {
      // Stockage indisponible (navigation privée, réglages) : on ouvre quand même.
    }
    setOuvert(true);
    // Une seule fois, à l'arrivée : l'état initial ne bouge plus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fermer = () => {
    setOuvert(false);
    // Fermé sans répondre : on s'en souvient, pour ne pas le rouvrir au prochain
    // rechargement. La question reste dans la page.
    if (!choix) {
      try {
        sessionStorage.setItem(cleFermeture(reference), "1");
      } catch {
        // Sans stockage, il se rouvrira : c'est un défaut mineur, pas une erreur.
      }
    }
  };

  const titre = choix === "souhaite"
    ? t("transfert.ouiTitre")
    : choix === "refuse"
      ? t("transfert.nonTitre")
      : t("transfert.questionTitre");

  return (
    <>
      <CarteTransfert etat={etat} contexte={contexte} />

      <FeuilleBasse
        ouverte={ouvert}
        onFermer={fermer}
        titre={titre}
        etiquetteFermer={t("demande.fermer")}
        className="popup-entree"
      >
        <CorpsPopup etat={etat} contexte={contexte} onFermer={fermer} />
      </FeuilleBasse>
    </>
  );
}

/* ───────────────────────────── Pièces communes ───────────────────────────── */

function MessageErreur({ erreur, reference }: { erreur: NonNullable<Etat["erreur"]>; reference: string }) {
  const t = useT();
  return (
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
}

/** Le texte du oui : l'e-mail n'est annoncé que s'il est réellement parti. */
function MessageOui({ emailEnvoye }: { emailEnvoye: boolean }) {
  const t = useT();
  return <>{emailEnvoye ? t("transfert.ouiEmail") : t("transfert.ouiSansEmail")}</>;
}

/** Le numéro de vol par WhatsApp, et le choix d'un véhicule : la suite d'un oui. */
function SuiteDuOui({ contexte }: { contexte: Contexte }) {
  const t = useT();
  return (
    <>
      <p className="text-[13px] text-encre-douce">{t("transfert.ouiVol")}</p>
      <a
        href={lienWhatsapp(t("whatsapp.transfert", { reference: contexte.reference }))}
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
          href={contexte.lienVehicules}
          data-umami-event="transfert-choisir-vehicule"
          className="font-semibold text-primaire underline underline-offset-2"
        >
          {t("transfert.ouiVehiculesLien")}
        </Lien>
      </p>
    </>
  );
}

/** Revenir sur sa réponse : un clic de travers ne doit pas enfermer le visiteur. */
function ChangerDAvis({ etat, vers, libelle }: { etat: Etat; vers: ChoixTransfert; libelle: string }) {
  const t = useT();
  return (
    <p className="mt-3 text-[12.5px] text-encre-douce">
      {t("transfert.changer")}{" "}
      <button
        type="button"
        onClick={() => etat.repondre(vers)}
        disabled={etat.enCours}
        data-umami-event={vers === "souhaite" ? "transfert-oui" : "transfert-non"}
        className="font-semibold text-primaire underline underline-offset-2 disabled:opacity-50"
      >
        {etat.enCours ? t("transfert.enCours") : libelle}
      </button>
    </p>
  );
}

/* ─────────────────────────────── La carte ─────────────────────────────── */

/** La carte dans la page : elle reste, popup fermé ou non. */
function CarteTransfert({ etat, contexte }: { etat: Etat; contexte: Contexte }) {
  const t = useT();

  if (etat.choix === "souhaite") {
    return (
      <section aria-live="polite" className="mt-5 rounded-2xl border border-succes/40 bg-teinte-vert/50 p-4 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-succes">
            <Icone nom="coche-cercle" taille={24} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-encre">{t("transfert.ouiTitre")}</h2>
            <p className="mt-1 text-[13.5px] leading-snug text-encre">
              <MessageOui emailEnvoye={etat.emailEnvoye} />
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-succes/20 pt-3">
          <SuiteDuOui contexte={contexte} />
        </div>

        <ChangerDAvis etat={etat} vers="refuse" libelle={t("transfert.changerNon")} />
        {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
      </section>
    );
  }

  if (etat.choix === "refuse") {
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

        <ChangerDAvis etat={etat} vers="souhaite" libelle={t("transfert.changerOui")} />
        {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
      </section>
    );
  }

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
            {t("transfert.questionTexte", { lieu: contexte.lieu, jour: contexte.jour })}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        <BoutonOui etat={etat} />
        <BoutonNon etat={etat} />
      </div>

      {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
    </section>
  );
}

function BoutonOui({ etat, grand = false }: { etat: Etat; grand?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => etat.repondre("souhaite")}
      disabled={etat.enCours}
      data-umami-event="transfert-oui"
      className={
        (grand ? "h-[52px] text-[15.5px] " : "h-[46px] text-[14.5px] ") +
        "w-full rounded-pill border border-transparent bg-primaire px-4 font-semibold text-white " +
        "shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all hover:bg-[#072c4e] " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire active:scale-[0.99] disabled:opacity-50"
      }
    >
      {etat.enCours ? t("transfert.enCours") : t("transfert.oui")}
    </button>
  );
}

function BoutonNon({ etat, grand = false }: { etat: Etat; grand?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => etat.repondre("refuse")}
      disabled={etat.enCours}
      data-umami-event="transfert-non"
      className={
        (grand ? "h-[52px] text-[15.5px] " : "h-[46px] text-[14.5px] ") +
        "w-full rounded-pill border border-contour bg-surface px-4 font-semibold text-encre transition-colors " +
        "hover:bg-champ focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire disabled:opacity-50"
      }
    >
      {t("transfert.non")}
    </button>
  );
}

/* ─────────────────────────────── Le popup ─────────────────────────────── */

/**
 * Le contenu du popup. Le titre est celui de la fenêtre, dans son en-tête : il
 * n'est pas répété ici.
 *
 * Plus grand que la carte, volontairement : une icône large, des boutons de 52 px
 * de haut, une seule décision par écran. C'est ce qui fait qu'on le remarque, et
 * qu'on y répond d'un pouce.
 */
function CorpsPopup({ etat, contexte, onFermer }: { etat: Etat; contexte: Contexte; onFermer: () => void }) {
  const t = useT();

  /* ── Le oui ── */
  if (etat.choix === "souhaite") {
    return (
      <div aria-live="polite" className="text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-succes">
            <Icone nom="coche-cercle" taille={32} />
          </span>
          <p className="text-[15px] leading-snug text-encre">
            <MessageOui emailEnvoye={etat.emailEnvoye} />
          </p>
        </div>

        <div className="mt-4 rounded-2xl bg-teinte-vert/50 p-4">
          <SuiteDuOui contexte={contexte} />
        </div>

        <button
          type="button"
          onClick={onFermer}
          className="mt-5 h-[52px] w-full rounded-pill bg-primaire px-4 text-[15.5px] font-semibold text-white shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all hover:bg-[#072c4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire active:scale-[0.99]"
        >
          {t("transfert.continuer")}
        </button>

        <ChangerDAvis etat={etat} vers="refuse" libelle={t("transfert.changerNon")} />
        {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
      </div>
    );
  }

  /* ── Le non ── */
  if (etat.choix === "refuse") {
    return (
      <div aria-live="polite" className="text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-primaire">
            <Icone nom="coche-cercle" taille={32} />
          </span>
          <p className="text-[15px] leading-snug text-encre">{t("transfert.nonTexte")}</p>
        </div>

        <button
          type="button"
          onClick={onFermer}
          className="mt-5 h-[52px] w-full rounded-pill bg-primaire px-4 text-[15.5px] font-semibold text-white shadow-[0_4px_16px_-4px_rgb(0_29_53/0.4)] transition-all hover:bg-[#072c4e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire active:scale-[0.99]"
        >
          {t("transfert.continuer")}
        </button>

        <ChangerDAvis etat={etat} vers="souhaite" libelle={t("transfert.changerOui")} />
        {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
      </div>
    );
  }

  /* ── La question ── */
  return (
    <div className="text-left">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teinte-bleu text-primaire">
          <Icone nom="avion" taille={32} />
        </span>
        <p className="mt-3.5 max-w-[38ch] text-[15px] leading-snug text-encre-douce">
          {t("transfert.questionTexte", { lieu: contexte.lieu, jour: contexte.jour })}
        </p>
      </div>

      <div className="mt-5 grid gap-2.5">
        <BoutonOui etat={etat} grand />
        <BoutonNon etat={etat} grand />
      </div>

      <p className="mt-3 text-center">
        <button
          type="button"
          onClick={onFermer}
          className="text-[13px] font-semibold text-encre-douce underline underline-offset-2 hover:text-encre"
        >
          {t("transfert.plusTard")}
        </button>
      </p>

      {etat.erreur && <MessageErreur erreur={etat.erreur} reference={contexte.reference} />}
    </div>
  );
}
