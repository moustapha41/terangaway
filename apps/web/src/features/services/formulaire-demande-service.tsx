"use client";

import { useState } from "react";
import type { ServiceALaDemande } from "@teranga/contracts";
import { Bandeau, Bouton, Carte, Champ, Compteur, Icone } from "@teranga/ui";
import { CHAMPS, CHAMP_MESSAGE, type Champ as Declaration } from "./champs";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { creerDemandeServiceAction } from "./actions";

/**
 * Demande d'un service sans catalogue (V2).
 *
 * Les champs ne sont pas écrits ici : chaque service les déclare dans
 * `champs.ts`, et ce formulaire les rend. Un nombre de couverts n'a rien à
 * voir avec une catégorie de billet, et un formulaire unique aurait obligé
 * l'équipe à rappeler pour tout préciser.
 *
 * Aucun prix n'est affiché ni demandé : il n'y a rien à chiffrer tant que
 * l'équipe n'a pas trouvé. C'est dit à l'écran, pour que personne n'attende
 * un paiement qui ne viendra pas.
 *
 * `messageInitial` et `valeursInitiales` amorcent le formulaire. Ils servent
 * aux pages qui arrivent avec un contexte — « un guide pour Gorée » depuis la
 * galerie des sites, « papiers perdus » depuis la page d'assistance — pour que
 * le visiteur n'ait pas à ressaisir ce qu'il vient de cliquer. Tout reste
 * modifiable : ce sont des amorces, pas des valeurs imposées.
 */
export function FormulaireDemandeService({
  service,
  messageInitial = "",
  valeursInitiales,
}: {
  service: ServiceALaDemande;
  messageInitial?: string;
  /** Valeurs de départ, par clé de champ. Les clés inconnues sont ignorées. */
  valeursInitiales?: Record<string, string>;
}) {
  const t = useT();
  const naviguer = useNaviguer();

  const declarations = CHAMPS[service];
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      declarations.map((c) => {
        // Une amorce ne vaut que si le champ la connaît : un « besoin » qui ne
        // figure pas dans la déclaration afficherait un bouton sélectionné que
        // le visiteur ne verrait nulle part.
        const propose = valeursInitiales?.[c.cle];
        const accepte =
          propose !== undefined && (c.valeurs === undefined || c.valeurs.includes(propose));
        if (accepte) return [c.cle, propose];
        return [c.cle, c.type === "nombre" ? "2" : c.valeurs?.[0] ?? ""];
      }),
    ),
  );
  const [message, setMessage] = useState(messageInitial);
  // Les coordonnées voyagent avec la demande : il n'y a plus de code à saisir,
  // et c'est par là que l'équipe rappellera. Sans elles, personne ne sait à qui
  // répondre — ce service n'a pas de catalogue, tout se règle de vive voix.
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, boolean>>({});
  const [envoi, setEnvoi] = useState<"repos" | "encours" | "fait" | "echec">("repos");
  const [motifEchec, setMotifEchec] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [emailEnvoye, setEmailEnvoye] = useState(false);

  const poser = (cle: string, valeur: string) =>
    setValeurs((avant) => ({ ...avant, [cle]: valeur }));

  async function envoyer() {
    const manques: Record<string, boolean> = Object.fromEntries(
      declarations
        .filter((c) => c.obligatoire && !valeurs[c.cle]?.trim())
        .map((c) => [c.cle, true]),
    );
    manques.contactNom = nom.trim().length < 2;
    manques.contactEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    manques.contactTelephone = telephone.replace(/\D/g, "").length < 6;
    setErreurs(manques);
    if (Object.values(manques).some(Boolean)) return;

    setEnvoi("encours");
    const resultat = await creerDemandeServiceAction(
      {
        service,
        details: valeurs,
        message: message.trim() || undefined,
      },
      { email, nom, telephone },
    );

    if (resultat.succes) {
      setReference(resultat.demande.reference);
      setEmailEnvoye(resultat.demande.emailEnvoye);
      setEnvoi("fait");
    } else {
      console.error("[service] envoi de la demande impossible", resultat.erreur);
      // L'action nomme la cause. L'afficher vaut mieux qu'un message générique :
      // le visiteur sait alors s'il doit corriger sa saisie ou réessayer.
      setMotifEchec(resultat.message ?? null);
      setEnvoi("echec");
    }
  }

  if (envoi === "fait") {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-pill bg-teinte-vert text-succes">
          <Icone nom="coche-cercle" taille={32} />
        </span>
        <h2 className="mt-5 text-titre-1 text-encre">{t("demandeService.envoyeeTitre")}</h2>
        <p className="mt-2 text-petit text-encre-douce chiffres-tabulaires">{reference}</p>
        <p className="mx-auto mt-3 max-w-[46ch] text-corps text-encre-douce">
          {t("demandeService.envoyeeTexte")}
        </p>
        <p role="status" className="mx-auto mt-2 max-w-[46ch] text-petit text-encre-douce">
          {emailEnvoye ? t("confirmation.lienEnvoye") : t("confirmation.lienNonEnvoye")}
        </p>
        <div className="mx-auto mt-7 max-w-[320px]">
          <Bouton variante="principal" largeur="pleine" onClick={() => naviguer("/mes-demandes")}>
            {t("demandeService.suivre")}
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void envoyer();
      }}
      className="space-y-5"
    >
      <Bandeau variante="information">{t("demandeService.pasDeCatalogue")}</Bandeau>

      {declarations.map((c) => (
        <ChampDeclare
          key={c.cle}
          declaration={c}
          valeur={valeurs[c.cle] ?? ""}
          onChange={(v) => poser(c.cle, v)}
          enErreur={erreurs[c.cle] === true}
        />
      ))}

      <Champ
        libelle={t("demande.nomComplet")}
        autoComplete="name"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        erreur={erreurs.contactNom ? t("demande.nomRequis") : undefined}
      />
      <Champ
        libelle={t("demande.email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        erreur={erreurs.contactEmail ? t("demande.emailRequis") : undefined}
      />
      <Champ
        libelle={t("demande.telephone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        tabulaire
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        erreur={erreurs.contactTelephone ? t("demande.telephoneRequis") : undefined}
      />

      <label className="block">
        <span className="mb-1.5 block text-petit text-encre">
          {t(`demandeService.champ.${CHAMP_MESSAGE.cle}`)}
        </span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("demandeService.messagePlaceholder")}
          className="w-full rounded-control border border-contour-champ bg-surface px-4 py-3 text-petit text-encre outline-none placeholder:text-encre-douce focus-visible:border-primaire"
        />
      </label>

      {envoi === "echec" && (
        <Bandeau variante="erreur">
          <strong className="block font-semibold">{t("demandeService.echecTitre")}</strong>
          {motifEchec ?? t("demandeService.echecTexte")}
        </Bandeau>
      )}

      <Bandeau variante="information">{t("demandeService.aucunPaiement")}</Bandeau>

      <Bouton type="submit" variante="principal" largeur="pleine" enCours={envoi === "encours"}>
        {t("demandeService.envoyer")}
      </Bouton>
    </form>
  );
}

function ChampDeclare({
  declaration,
  valeur,
  onChange,
  enErreur,
}: {
  declaration: Declaration;
  valeur: string;
  onChange: (v: string) => void;
  enErreur: boolean;
}) {
  const t = useT();
  const libelle = t(`demandeService.champ.${declaration.cle}`);
  const erreur = enErreur ? t("demandeService.requis") : undefined;

  if (declaration.type === "nombre") {
    return (
      <Carte className="p-4">
        <Compteur
          libelle={libelle}
          valeur={Number(valeur) || declaration.min || 1}
          min={declaration.min ?? 1}
          max={declaration.max ?? 99}
          onChange={(n) => onChange(String(n))}
        />
      </Carte>
    );
  }

  if (declaration.type === "choix") {
    return (
      <fieldset>
        <legend className="mb-2 text-petit text-encre">{libelle}</legend>
        <div className="flex flex-wrap gap-2">
          {declaration.valeurs?.map((v) => {
            const actif = valeur === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={actif}
                onClick={() => onChange(v)}
                className={
                  "inline-flex min-h-[var(--size-touch)] items-center rounded-pill border px-4 text-petit font-semibold " +
                  (actif
                    ? "border-primaire bg-primaire text-white"
                    : "border-contour-champ bg-surface text-encre hover:border-primaire/40")
                }
              >
                {t(`demandeService.champ.${v}`)}
              </button>
            );
          })}
        </div>
        {erreur && <p className="mt-1 text-petit text-danger">{erreur}</p>}
      </fieldset>
    );
  }

  return (
    <Champ
      libelle={libelle}
      type={declaration.type === "date" ? "date" : "text"}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      erreur={erreur}
    />
  );
}
