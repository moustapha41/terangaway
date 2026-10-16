"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Bandeau } from "@teranga/ui";
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
 *
 * L'habillage suit `maquette_signup.png` : libellé au-dessus, icône dans le
 * champ, œil sur les deux mots de passe. Les champs sont écrits ici plutôt que
 * repris de `Champ` (@teranga/ui), qui ne porte ni icône ni bouton de fin de
 * ligne — les y ajouter aurait changé l'atelier pour un seul écran.
 */
export function FormulaireInscription({
  suite,
  googleActif = false,
}: {
  suite?: string;
  /** Google n'est proposé que si le serveur a ses identifiants. */
  googleActif?: boolean;
}) {
  const t = useT();
  const langue = useLangue();
  const [etat, action, enCours] = useActionState<EtatInscription, FormData>(inscrireAction, {});

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  /** Erreurs vues par le navigateur, affichées au moment de quitter le champ. */
  const [touches, setTouches] = useState<Record<string, boolean>>({});
  const [googleDemande, setGoogleDemande] = useState(false);

  const motDePasseTropCourt =
    motDePasse.length > 0 && motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE;
  const confirmationDifferente = confirmation.length > 0 && confirmation !== motDePasse;

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
    <div className="space-y-4 [@media(max-height:860px)]:space-y-3">
      <form action={action} className="space-y-3.5 [@media(max-height:860px)]:space-y-2.5">
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
          id="inscription-nom"
          name="nom"
          libelle={t("inscription.nomComplet")}
          placeholder={t("inscription.nomPlaceholder")}
          icone={<User strokeWidth={1.8} className="h-[19px] w-[19px]" />}
          autoComplete="name"
          required
          valeur={nom}
          onChange={setNom}
          erreur={etat.erreurs?.nom}
        />

        <Champ
          id="inscription-email"
          name="email"
          type="email"
          inputMode="email"
          libelle={t("inscription.email")}
          placeholder={t("inscription.emailPlaceholder")}
          icone={<Mail strokeWidth={1.8} className="h-[19px] w-[19px]" />}
          autoComplete="email"
          required
          valeur={email}
          onChange={setEmail}
          erreur={etat.erreurs?.email}
        />

        <Champ
          id="inscription-mot-de-passe"
          name="motDePasse"
          type={motDePasseVisible ? "text" : "password"}
          libelle={t("inscription.motDePasse")}
          placeholder={t("inscription.motDePassePlaceholder")}
          icone={<Lock strokeWidth={1.8} className="h-[19px] w-[19px]" />}
          // `new-password` indique au gestionnaire de mots de passe qu'il s'agit
          // d'une création, et déclenche sa proposition de mot de passe fort.
          autoComplete="new-password"
          required
          valeur={motDePasse}
          onChange={setMotDePasse}
          onBlur={() => setTouches((p) => ({ ...p, motDePasse: true }))}
          erreur={erreurMotDePasse}
          // L'aide n'apparaît qu'à la première frappe : la maquette montre un
          // champ nu, et la règle de longueur n'a d'intérêt qu'une fois qu'on
          // écrit. Elle cède la place à l'erreur quand il y en a une.
          aide={
            erreurMotDePasse || motDePasse.length === 0
              ? undefined
              : t("inscription.motDePasseAide", { longueur: LONGUEUR_MINIMALE_MOT_DE_PASSE })
          }
          oeil={{
            visible: motDePasseVisible,
            basculer: () => setMotDePasseVisible((v) => !v),
            afficher: t("compte.afficherMotDePasse"),
            masquer: t("compte.masquerMotDePasse"),
          }}
        />

        <Champ
          id="inscription-confirmation"
          name="confirmation"
          type={confirmationVisible ? "text" : "password"}
          libelle={t("inscription.confirmation")}
          placeholder={t("inscription.confirmationPlaceholder")}
          icone={<Lock strokeWidth={1.8} className="h-[19px] w-[19px]" />}
          autoComplete="new-password"
          required
          valeur={confirmation}
          onChange={setConfirmation}
          onBlur={() => setTouches((p) => ({ ...p, confirmation: true }))}
          erreur={erreurConfirmation}
          oeil={{
            visible: confirmationVisible,
            basculer: () => setConfirmationVisible((v) => !v),
            afficher: t("compte.afficherMotDePasse"),
            masquer: t("compte.masquerMotDePasse"),
          }}
        />

        {/* Jamais grisé : les quatre champs sont `required`, et la concordance
            des mots de passe est dite sous le champ. C'est le navigateur qui
            retient une saisie incomplète, en nommant ce qui manque. */}
        <button
          type="submit"
          disabled={enCours}
          className={
            "mt-1 flex h-[52px] [@media(max-height:860px)]:h-[46px] w-full items-center justify-center gap-2.5 rounded-pill bg-primaire " +
            "text-[16px] font-semibold text-white shadow-[0_6px_0_-2px_var(--color-jaune-vif)] " +
            "transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "focus-visible:outline-primaire disabled:opacity-45"
          }
        >
          {t("inscription.creerMonCompte")}
          <ArrowRight strokeWidth={2.2} className="h-5 w-5" />
        </button>
      </form>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-contour" />
        <span className="text-[14px] text-encre-douce">{t("compte.ou")}</span>
        <span className="h-px flex-1 bg-contour" />
      </div>

      {(() => {
        const allure =
          "flex h-[48px] [@media(max-height:860px)]:h-[42px] w-full items-center justify-center gap-2.5 rounded-[14px] border " +
          "border-contour bg-surface px-3 text-[14.5px] text-encre transition-colors " +
          "hover:bg-champ focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire";
        const contenu = (
          <>
            <LogoGoogle />
            {t("compte.continuerAvec", { fournisseur: "Google" })}
          </>
        );
        // Un lien quand c'est configuré : le départ vers Google est une
        // navigation, pas une action interne à la page.
        return googleActif ? (
          <a
            href={`/api/auth/google?langue=${langue}&suite=${encodeURIComponent(suite ?? "")}`}
            className={allure}
          >
            {contenu}
          </a>
        ) : (
          <button type="button" onClick={() => setGoogleDemande(true)} className={allure}>
            {contenu}
          </button>
        );
      })()}

      {googleDemande && (
        <Bandeau variante="information">
          {t("compte.fournisseurIndisponible", { fournisseur: "Google" })}
        </Bandeau>
      )}
    </div>
  );
}

/** Le champ de la maquette : libellé au-dessus, icône dedans, œil facultatif. */
function Champ({
  id,
  name,
  libelle,
  placeholder,
  icone,
  valeur,
  onChange,
  onBlur,
  erreur,
  aide,
  oeil,
  ...reste
}: {
  id: string;
  name: string;
  libelle: string;
  placeholder: string;
  icone: React.ReactNode;
  valeur: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  erreur?: string;
  aide?: string;
  oeil?: { visible: boolean; basculer: () => void; afficher: string; masquer: string };
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "value" | "id">) {
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-[13.5px] font-medium text-encre">
        {libelle}
      </label>
      <div
        className={
          "mt-1.5 [@media(max-height:860px)]:mt-1 flex h-[48px] [@media(max-height:860px)]:h-[43px] items-center gap-3 rounded-[14px] border bg-surface px-4 " +
          "transition-colors focus-within:border-primaire/45 " +
          (erreur ? "border-danger" : "border-contour-champ")
        }
      >
        <span className="shrink-0 text-encre-douce">{icone}</span>
        <input
          id={id}
          name={name}
          placeholder={placeholder}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={[idErreur, idAide].filter(Boolean).join(" ") || undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-encre outline-none placeholder:text-encre-douce"
          {...reste}
        />
        {oeil && (
          <button
            type="button"
            onClick={oeil.basculer}
            aria-label={oeil.visible ? oeil.masquer : oeil.afficher}
            className="shrink-0 rounded-pill p-1 text-encre-douce transition-colors hover:text-encre"
          >
            {oeil.visible ? (
              <EyeOff strokeWidth={1.8} className="h-[19px] w-[19px]" />
            ) : (
              <Eye strokeWidth={1.8} className="h-[19px] w-[19px]" />
            )}
          </button>
        )}
      </div>
      {erreur ? (
        <p id={idErreur} className="mt-1 text-[12.5px] text-danger">
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={idAide} className="mt-1 text-[12.5px] text-encre-douce">
            {aide}
          </p>
        )
      )}
    </div>
  );
}

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[19px] w-[19px] shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.4Z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}
