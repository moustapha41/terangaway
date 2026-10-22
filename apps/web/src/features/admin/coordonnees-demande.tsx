"use client";

import { useState, useTransition } from "react";
import { Bandeau } from "@teranga/ui";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, UserCheck } from "lucide-react";
import type { CoordonneesAdmin } from "@teranga/contracts";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { saisirCoordonneesAction, verifierCoordonneesAction } from "./actions";
import {
  CHAMPS_COORDONNEES,
  cleErreurCoordonnees,
  nomActeur,
  saisieAEnvoyer,
  saisieInitiale,
  visiblesParLeVisiteur,
  type CleChampCoordonnees,
} from "./coordonnees-admin";
import { formaterDateHeure } from "./format";

/**
 * Les coordonnées d'une réservation : état, saisie, vérification.
 *
 * L'état affiché est celui que l'API a rendu, jamais une déduction de
 * l'écran : « vérifiées » n'apparaît que si la vérification est enregistrée
 * en base, avec son auteur et sa date.
 */
export function CoordonneesDemande({
  demandeId,
  initiales,
  erreurChargement,
}: {
  demandeId: string;
  initiales?: CoordonneesAdmin;
  /** Le code de refus de la lecture, quand elle a échoué. */
  erreurChargement?: { code: string; message: string };
}) {
  const t = useT();
  const langue = useLangue();
  const [vue, setVue] = useState<CoordonneesAdmin | undefined>(initiales);
  const [valeurs, setValeurs] = useState<Partial<Record<CleChampCoordonnees, string>>>(() =>
    initiales ? saisieInitiale(initiales) : {},
  );
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const texteErreur = (code: string, serveur: string) => {
    const cle = cleErreurCoordonnees(code);
    return cle ? t(cle) : serveur;
  };

  const enTete = (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#001D35] text-amber-300">
        <KeyRound className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{t("admin.coordonnees.titre")}</h2>
        <p className="text-xs text-slate-500">{t("admin.coordonnees.sousTitre")}</p>
      </div>
    </div>
  );

  if (!vue) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {enTete}
        <div className="mt-4">
          <Bandeau variante="erreur">
            {texteErreur(erreurChargement?.code ?? "INJOIGNABLE", erreurChargement?.message ?? "")}
          </Bandeau>
        </div>
      </div>
    );
  }

  const appliquer = (resultat: Awaited<ReturnType<typeof saisirCoordonneesAction>>, succes: string) => {
    if (resultat.succes) {
      setVue(resultat.coordonnees);
      setValeurs(saisieInitiale(resultat.coordonnees));
      setMessage({ ton: "succes", texte: succes });
    } else {
      setMessage({ ton: "erreur", texte: texteErreur(resultat.code, resultat.message) });
    }
  };

  const enregistrer = () =>
    demarrer(async () => {
      if (!vue.famille) return;
      appliquer(
        await saisirCoordonneesAction(demandeId, saisieAEnvoyer(vue.famille, valeurs)),
        t("admin.coordonnees.enregistrees"),
      );
    });

  const verifier = () =>
    demarrer(async () => {
      if (!vue.saisie) return;
      appliquer(await verifierCoordonneesAction(demandeId, vue.saisie.le), t("admin.coordonnees.verificationEnregistree"));
    });

  const visibles = visiblesParLeVisiteur(vue);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {enTete}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              vue.etat === "verifiees"
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                : vue.etat === "saisies"
                  ? "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                  : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
            }
          >
            {t(`admin.coordonnees.etat.${vue.etat}`)}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            {visibles ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {visibles ? t("admin.coordonnees.visibles") : t("admin.coordonnees.nonVisibles")}
          </span>
        </div>

        {vue.saisie && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
            {t("admin.coordonnees.saisiesPar", {
              nom: nomActeur(vue.saisie),
              date: formaterDateHeure(vue.saisie.le, langue),
            })}
          </p>
        )}
        {vue.verification && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("admin.coordonnees.verifieesPar", {
              nom: nomActeur(vue.verification),
              date: formaterDateHeure(vue.verification.le, langue),
            })}
          </p>
        )}
      </div>

      {!vue.famille ? (
        <div className="mt-4">
          <Bandeau variante="information">{t("admin.coordonnees.nonPrevues")}</Bandeau>
        </div>
      ) : !vue.saisissable ? (
        <div className="mt-4">
          <Bandeau variante="information">{t("admin.coordonnees.nonSaisissables")}</Bandeau>
        </div>
      ) : (
        <form
          className="mt-5 space-y-4"
          onSubmit={(evenement) => {
            evenement.preventDefault();
            enregistrer();
          }}
        >
          {CHAMPS_COORDONNEES[vue.famille].map((champ) => {
            const id = `coordonnees-${champ.cle}`;
            const commun = {
              id,
              name: champ.cle,
              required: champ.requis,
              value: valeurs[champ.cle] ?? "",
              onChange: (e: { target: { value: string } }) =>
                setValeurs((v) => ({ ...v, [champ.cle]: e.target.value })),
              autoComplete: "off",
              className:
                "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#001D35] focus:outline-none",
            };
            return (
              <div key={champ.cle} className="space-y-1.5">
                <label htmlFor={id} className="text-xs font-semibold text-slate-700">
                  {t(`admin.coordonnees.champ.${champ.cle}`)}
                  {champ.requis && <span className="text-red-600"> *</span>}
                </label>
                {champ.multiligne ? (
                  <textarea rows={3} maxLength={1000} {...commun} />
                ) : (
                  <input type={champ.type ?? "text"} maxLength={300} {...commun} />
                )}
              </div>
            );
          })}

          {vue.etat === "verifiees" && (
            <p className="text-xs text-amber-700">{t("admin.coordonnees.avertissementRessaisie")}</p>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-xl bg-[#001D35] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {t("admin.coordonnees.enregistrer")}
          </button>
        </form>
      )}

      {vue.etat === "saisies" && vue.saisissable && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {vue.peutVerifier ? (
            <button
              type="button"
              onClick={verifier}
              disabled={enCours}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t("admin.coordonnees.verifier")}
            </button>
          ) : (
            <Bandeau variante="information">{t("admin.coordonnees.attenteAutre")}</Bandeau>
          )}
        </div>
      )}

      {message && (
        <div className="mt-4" role="status">
          <Bandeau variante={message.ton === "succes" ? "succes" : "erreur"}>{message.texte}</Bandeau>
        </div>
      )}
    </div>
  );
}
