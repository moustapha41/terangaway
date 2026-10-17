"use client";

import { useState, useTransition } from "react";
import { Bandeau } from "@teranga/ui";
import { Mail, KeyRound, ArrowRight, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { connexionAdminAction, envoyerCodeAdminAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";

export function FormulaireConnexionAdmin({
  desactive = false,
}: {
  desactive?: boolean;
}) {
  const t = useT();
  const naviguer = useNaviguer();
  const [etape, setEtape] = useState<"adresse" | "code">("adresse");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [codeDemo, setCodeDemo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const demanderCode = () =>
    demarrer(async () => {
      setErreur(null);
      const { envoye, codeDemo: codeRecu, motif } = await envoyerCodeAdminAction(email);
      if (!envoye) {
        setErreur(
          motif === "injoignable"
            ? t("admin.erreurServeur")
            : motif === "envoi"
              ? t("admin.erreurEnvoi")
              : motif === "trop"
                ? t("admin.erreurTropDeCodes")
                : t("admin.erreurAdresse"),
        );
        return;
      }
      if (codeRecu) {
        setCodeDemo(codeRecu);
      }
      setNote(t("admin.codeEnvoye"));
      setEtape("code");
    });

  const entrer = () =>
    demarrer(async () => {
      setErreur(null);
      const resultat = await connexionAdminAction(email, code);
      if (resultat.succes) {
        naviguer("/admin");
        return;
      }
      setNote(null);
      setErreur(
        resultat.erreur === "role"
          ? t("admin.erreurRole", { email: email.trim().toLowerCase() })
          : resultat.erreur === "code"
            ? t("admin.erreurCode")
            : t("admin.erreurServeur"),
      );
    });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
      {/* En-tête de la carte avec indicateur d'étape */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Lock className="h-3.5 w-3.5 text-amber-500" />
          <span>Authentification sécurisée</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-6 rounded-full transition-all ${
              etape === "adresse" ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
          <span
            className={`h-2 w-6 rounded-full transition-all ${
              etape === "code" ? "bg-amber-500" : "bg-slate-200"
            }`}
          />
        </div>
      </div>

      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("admin.connexionTitre")}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {etape === "adresse" ? t("admin.connexionTexte") : "Saisissez le code temporaire envoyé à votre boîte e-mail."}
      </p>

      {/* Code démo en environnement local */}
      {codeDemo && etape === "code" && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Code de démonstration local :</span>{" "}
            <span className="rounded bg-white px-2 py-0.5 font-mono font-bold text-amber-700 shadow-sm border border-amber-300">
              {codeDemo}
            </span>
          </div>
        </div>
      )}

      {note && !codeDemo && (
        <div className="mt-4">
          <Bandeau variante="information">{note}</Bandeau>
        </div>
      )}
      {erreur && (
        <div className="mt-4">
          <Bandeau variante="erreur">{erreur}</Bandeau>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (etape === "adresse") demanderCode();
          else entrer();
        }}
        className="mt-6 space-y-4"
      >
        {etape === "adresse" ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t("admin.email")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="admin@teranga.sn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={desactive || enCours}
                required
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10 disabled:bg-slate-100"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                {t("admin.code")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setEtape("adresse");
                  setCode("");
                }}
                className="text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                Changer d&apos;e-mail
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={desactive || enCours}
                autoFocus
                required
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 font-mono text-center text-lg tracking-widest text-slate-900 shadow-sm placeholder:text-slate-300 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10 disabled:bg-slate-100"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={desactive || enCours || (etape === "adresse" ? !email : code.length < 6)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#001D35] py-3 text-sm font-semibold text-white shadow-lg shadow-[#001D35]/20 transition-all hover:bg-[#002B4F] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {enCours ? (
            <span>Traitement en cours...</span>
          ) : etape === "adresse" ? (
            <>
              <span>{t("admin.envoyerCode")}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>{t("admin.entrer")}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
