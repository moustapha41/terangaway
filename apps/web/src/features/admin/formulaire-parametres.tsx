"use client";

import { useState, useTransition } from "react";
import {
  Sliders,
  Clock,
  ShieldAlert,
  Bell,
  Coins,
  Save,
  CheckCircle2,
  Mail,
  Globe,
  Lock,
} from "lucide-react";
import { Bandeau } from "@teranga/ui";

export function FormulaireParametres() {
  const [sauvegardeMessage, setSauvegardeMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // État local des paramètres de gestion
  const [nomPlateforme, setNomPlateforme] = useState("Teranga Way");
  const [emailSupport, setEmailSupport] = useState("support@teranga.sn");
  const [delaiReponseHeures, setDelaiReponseHeures] = useState("24");
  const [seuilRetardHeures, setSeuilRetardHeures] = useState("48");
  const [devisePrincipale, setDevisePrincipale] = useState("XOF");
  const [notificationsEmail, setNotificationsEmail] = useState(true);
  const [notificationsSms, setNotificationsSms] = useState(true);
  const [validationOffresAutomatique, setValidationOffresAutomatique] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    demarrer(async () => {
      // Simuler une sauvegarde persistante
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSauvegardeMessage("Les paramètres ont été mis à jour avec succès.");
      setTimeout(() => setSauvegardeMessage(null), 4000);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {sauvegardeMessage && (
        <div className="animate-in fade-in">
          <Bandeau variante="information">{sauvegardeMessage}</Bandeau>
        </div>
      )}

      {/* 1. Configuration Générale */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Plateforme & Opérations
            </h2>
            <p className="text-xs text-slate-500">
              Paramètres généraux et identifiants de contact
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Nom de la plateforme
            </label>
            <input
              type="text"
              value={nomPlateforme}
              onChange={(e) => setNomPlateforme(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              E-mail support & supervision
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={emailSupport}
                onChange={(e) => setEmailSupport(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Devise de facturation principale
            </label>
            <select
              value={devisePrincipale}
              onChange={(e) => setDevisePrincipale(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            >
              <option value="XOF">FCFA (Franc CFA BCEAO)</option>
              <option value="EUR">EUR (€ Euro)</option>
              <option value="USD">USD ($ Dollar US)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Fuseau horaire opérationnel
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <Globe className="h-4 w-4 text-slate-400" />
              <span>Africa/Dakar (UTC+0, heure légale)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Règles Opérationnelles & SLA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Délais & SLA de Prise en Charge
            </h2>
            <p className="text-xs text-slate-500">
              Seuils de réactivité pour le traitement des réservations
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Délai cible de confirmation (en heures)
            </label>
            <input
              type="number"
              min="1"
              max="72"
              value={delaiReponseHeures}
              onChange={(e) => setDelaiReponseHeures(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Temps imparti avant notification de relance de l&apos;équipe.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Seuil de passage en statut &quot;En retard&quot; (heures)
            </label>
            <input
              type="number"
              min="12"
              max="96"
              value={seuilRetardHeures}
              onChange={(e) => setSeuilRetardHeures(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Alimente le compteur d&apos;alerte sur le tableau de bord.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Notifications & Alertes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Canaux de Notification
            </h2>
            <p className="text-xs text-slate-500">
              Routage des messages d&apos;alerte et relances automatiques
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 cursor-pointer">
            <div>
              <span className="block text-xs font-bold text-slate-800">
                Notifications e-mail de nouvelle demande
              </span>
              <span className="block text-[11px] text-slate-500">
                Avertir l&apos;équipe d&apos;administration dès l&apos;arrivée d&apos;une réservation
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationsEmail}
              onChange={(e) => setNotificationsEmail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#001D35] focus:ring-[#001D35]"
            />
          </label>

          <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 cursor-pointer">
            <div>
              <span className="block text-xs font-bold text-slate-800">
                Alertes SMS / WhatsApp vers prestataires
              </span>
              <span className="block text-[11px] text-slate-500">
                Envoyer un message direct au partenaire lors de l&apos;assignation
              </span>
            </div>
            <input
              type="checkbox"
              checked={notificationsSms}
              onChange={(e) => setNotificationsSms(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#001D35] focus:ring-[#001D35]"
            />
          </label>
        </div>
      </div>

      {/* Bouton de sauvegarde */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 rounded-xl bg-[#001D35] px-6 py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#002B4F] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4 text-amber-400" />
          <span>{enCours ? "Enregistrement..." : "Enregistrer les paramètres"}</span>
        </button>
      </div>
    </form>
  );
}
