"use client";

import { useState, useTransition } from "react";
import { Bandeau } from "@teranga/ui";
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  UserCheck,
  Coins,
  FileText,
  Lock,
  ChevronDown,
  XCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import type {
  ContactAdmin,
  DemandeAdmin,
  MiseAJourDemandeAdmin,
  StatutDemande,
} from "@teranga/contracts";
import { MOTIFS_REFUS, STATUTS_DEMANDE } from "@teranga/contracts";
import { traiterDemandeAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";

export function TraitementDemande({
  demande,
  prestataires,
}: {
  demande: DemandeAdmin;
  prestataires: ContactAdmin[];
}) {
  const t = useT();
  const [statut, setStatut] = useState<StatutDemande | "">("");
  const [motif, setMotif] = useState<string>("");
  const [note, setNote] = useState(demande.noteInterne ?? "");
  const [prix, setPrix] = useState(
    demande.prixPropose !== undefined ? String(demande.prixPropose) : "",
  );
  const [prestataire, setPrestataire] = useState(demande.prestataire?.id ?? "");
  const [message, setMessage] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const prixInitial = demande.prixPropose !== undefined ? String(demande.prixPropose) : "";
  const prestataireInitial = demande.prestataire?.id ?? "";

  const options = [...prestataires];
  if (
    demande.prestataire &&
    !options.some((p) => p.id === demande.prestataire!.id)
  ) {
    options.unshift(demande.prestataire);
  }

  const enregistrer = () =>
    demarrer(async () => {
      const maj: MiseAJourDemandeAdmin = {};
      if (statut) maj.statut = statut;
      if (statut === "refusee" && motif) maj.motifRefus = motif as MiseAJourDemandeAdmin["motifRefus"];
      if (note !== (demande.noteInterne ?? "")) maj.noteInterne = note;
      if (prix !== prixInitial) maj.prixPropose = prix.trim() === "" ? null : Number(prix);
      if (prestataire !== prestataireInitial) {
        maj.prestataireId = prestataire.trim() === "" ? null : prestataire.trim();
      }

      if (Object.keys(maj).length === 0) {
        setMessage({ ton: "succes", texte: t("admin.enregistre") });
        return;
      }

      const resultat = await traiterDemandeAction(demande.id, maj);
      if (resultat.succes) {
        setStatut("");
        setMotif("");
        setMessage({ ton: "succes", texte: t("admin.enregistre") });
      } else {
        setMessage({ ton: "erreur", texte: resultat.message });
      }
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#001D35] text-amber-300">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {t("admin.traitement")}
            </h2>
            <p className="text-[11px] text-slate-500">
              Mise à jour du statut, assignation et chiffrage
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4">
          <Bandeau variante={message.ton === "succes" ? "information" : "erreur"}>
            {message.texte}
          </Bandeau>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {/* Nouveau statut */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            {t("admin.statut")}
          </label>
          <div className="relative">
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutDemande | "")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            >
              <option value="">{t("admin.statutInchange")}</option>
              {STATUTS_DEMANDE.map((s) => (
                <option key={s} value={s}>
                  {t(`statut.${s}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Motif du refus si statut = refusee */}
        {statut === "refusee" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>{t("admin.motifRefus")}</span>
            </div>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-400 focus:outline-none"
            >
              <option value="">Sélectionnez un motif de refus</option>
              {MOTIFS_REFUS.map((m) => (
                <option key={m} value={m}>
                  {t(`admin.motif.${m}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prestataire assigné */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
              <span>{t("admin.prestataireId")}</span>
            </label>
          </div>
          <select
            value={prestataire}
            onChange={(e) => setPrestataire(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
          >
            <option value="">{t("admin.prestataireAucun")}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.nom, p.email, p.telephone].filter(Boolean).join(" · ") || p.id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">{t("admin.prestataireIdAide")}</p>
        </div>

        {/* Proposition chiffrée (devis) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-slate-400" />
              <span>{t("admin.prixPropose")}</span>
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="Ex: 50000"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-16 font-mono text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              FCFA
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{t("admin.prixProposeAide")}</p>
        </div>

        {/* Note interne sécurisée */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-amber-500" />
              <span>{t("admin.noteInterne")}</span>
            </label>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
              Interne équipe
            </span>
          </div>
          <textarea
            rows={3}
            placeholder="Instructions de suivi, consignes d'appel ou retours partenaires..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
          />
          <p className="mt-0.5 text-[11px] text-slate-400">{t("admin.noteInterneAide")}</p>
        </div>

        {/* Bouton d'action */}
        <button
          type="button"
          disabled={enCours || (statut === "refusee" && !motif)}
          onClick={enregistrer}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001D35] py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#002B4F] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {enCours ? (
            <span>Sauvegarde en cours...</span>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-amber-400" />
              <span>{t("admin.enregistrer")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
