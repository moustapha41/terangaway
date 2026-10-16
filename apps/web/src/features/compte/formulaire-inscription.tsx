"use client";

import { useActionState, useState } from "react";
import { Bandeau, Bouton, Champ } from "@teranga/ui";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { Lien } from "@/lib/i18n/lien";
import { inscrireAction, type EtatInscription } from "./inscription-actions";
import { LONGUEUR_MINIMALE_MOT_DE_PASSE } from "./regles-mot-de-passe";

/**
 * Inscription : nom, adresse, mot de passe, confirmation.
 *
 * Le composant est client parce que la saisie doit survivre à une erreur
 * renvoyée par le serveur. Avec des champs non contrôlés, un refus sur le
 * mot de passe reviendrait à faire tout retaper — y compris le nom et
 * l'adresse, qui étaient bons.
 *
 * La validation du navigateur sert à répondre tout de suite ; celle de
 * `inscrireAction` et celle de l'API font foi.
 */
export function FormulaireInscription({ suite }: { suite?: string }) {
  const t = useT();
  const langue = useLangue();
  const [etat, action, enCours] = useActionState<EtatInscription, FormData>(inscrireAction, {});

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  /** Erreurs vues par le navigateur, affichées au moment de quitter le champ. */
  const [touches, setTouches] = useState<Record<string, boolean>>({});

  const motDePasseTropCourt =
    motDePasse.length > 0 && motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE;
  const confirmationDifferente = confirmation.length > 0 && confirmation !== motDePasse;

  const complet =
    nom.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    motDePasse.length >= LONGUEUR_MINIMALE_MOT_DE_PASSE &&
    confirmation === motDePasse;

  /** L'erreur à montrer : celle du serveur d'abord, celle du navigateur ensuite. */
  const erreurMotDePasse =
    etat.erreurs?.motDePasse ??
    (touches.motDePasse && motDePasseTropCourt
      ? t("inscription.motDePasseCourtErreur", { longueur: LONGUEUR_MINIMALE_MOT_DE_PASSE })
      : undefined);

  const erreurConfirmation =
    etat.erreurs?.confirmation ??
    (touches.confirmation && confirmationDifferente
      ? t("inscription.confirmationErreur")
      : undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <input type="hidden" name="langue" value={langue} />

      {etat.message && (
        <Bandeau variante="erreur">
          <strong className="block font-semibold">{t("inscription.echecTitre")}</strong>
          {etat.message}
        </Bandeau>
      )}

      {etat.dejaInscrit && (
        <Bandeau
          variante="information"
          action={
            <Lien
              href={`/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {t("inscription.seConnecter")}
            </Lien>
          }
        >
          {t("inscription.dejaInscrit")}
        </Bandeau>
      )}

      <Champ
        libelle={t("inscription.nomComplet")}
        name="nom"
        autoComplete="name"
        required
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        erreur={etat.erreurs?.nom}
      />

      <Champ
        libelle={t("inscription.email")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        erreur={etat.erreurs?.email}
      />

      <Champ
        libelle={t("inscription.motDePasse")}
        name="motDePasse"
        type="password"
        // `new-password` indique au gestionnaire de mots de passe qu'il s'agit
        // d'une création, et déclenche sa proposition de mot de passe fort.
        autoComplete="new-password"
        required
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        onBlur={() => setTouches((p) => ({ ...p, motDePasse: true }))}
        // `aide` est remplacée par l'erreur quand il y en a une : le composant
        // gère déjà cette bascule, inutile de la refaire ici.
        aide={t("inscription.motDePasseAide", { longueur: LONGUEUR_MINIMALE_MOT_DE_PASSE })}
        erreur={erreurMotDePasse}
      />

      <Champ
        libelle={t("inscription.confirmation")}
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        onBlur={() => setTouches((p) => ({ ...p, confirmation: true }))}
        erreur={erreurConfirmation}
      />

      <Bouton
        type="submit"
        variante="principal"
        largeur="pleine"
        enCours={enCours}
        disabled={!complet}
      >
        {t("inscription.creerMonCompte")}
      </Bouton>
    </form>
  );
}
