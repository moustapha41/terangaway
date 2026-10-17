"use client";

import { useState } from "react";
import {
  Users,
  ShieldCheck,
  UserCheck,
  User,
  Plus,
  Search,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  MoreVertical,
  X,
} from "lucide-react";
import type { ContactAdmin, CompteAdministrateur } from "@teranga/contracts";

interface UtilisateurItem {
  id: string;
  nom: string;
  email: string;
  telephone?: string;
  role: "ADMINISTRATEUR" | "PRESTATAIRE" | "VISITEUR";
  statut: "ACTIF" | "EN_ATTENTE";
  creeLe: string;
}

export function GestionUtilisateurs({
  administrateur,
  prestataires,
}: {
  administrateur: CompteAdministrateur | null;
  prestataires: ContactAdmin[];
}) {
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<string>("TOUS");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauEmail, setNouveauEmail] = useState("");
  const [nouveauRole, setNouveauRole] = useState<"ADMINISTRATEUR" | "PRESTATAIRE">("ADMINISTRATEUR");
  const [messageSucces, setMessageSucces] = useState<string | null>(null);

  // Construction de la liste des utilisateurs réels connus
  const initialUtilisateurs: UtilisateurItem[] = [
    ...(administrateur
      ? [
          {
            id: administrateur.id,
            nom: administrateur.nom || "Administrateur Principal",
            email: administrateur.email || "admin@teranga.sn",
            role: "ADMINISTRATEUR" as const,
            statut: "ACTIF" as const,
            creeLe: "2026-10-01",
          },
        ]
      : []),
    ...prestataires.map((p, idx) => ({
      id: p.id,
      nom: p.nom || `Partenaire ${idx + 1}`,
      email: p.email || `partenaire${idx + 1}@teranga.sn`,
      telephone: p.telephone,
      role: "PRESTATAIRE" as const,
      statut: "ACTIF" as const,
      creeLe: "2026-10-05",
    })),
  ];

  const [utilisateurs, setUtilisateurs] = useState<UtilisateurItem[]>(initialUtilisateurs);

  const handleAjoutUtilisateur = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauEmail) return;

    const nouvelUser: UtilisateurItem = {
      id: `usr_${Date.now()}`,
      nom: nouveauNom || (nouveauRole === "ADMINISTRATEUR" ? "Gestionnaire" : "Partenaire"),
      email: nouveauEmail.trim().toLowerCase(),
      role: nouveauRole,
      statut: "ACTIF",
      creeLe: new Date().toISOString().slice(0, 10),
    };

    setUtilisateurs([nouvelUser, ...utilisateurs]);
    setModalOuvert(false);
    setNouveauNom("");
    setNouveauEmail("");
    setMessageSucces(`Le compte ${nouvelUser.email} a été invité avec succès.`);
    setTimeout(() => setMessageSucces(null), 4000);
  };

  const utilisateursFiltres = utilisateurs.filter((u) => {
    const matchRole = filtreRole === "TOUS" || u.role === filtreRole;
    const matchTexte =
      !recherche ||
      u.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      u.email.toLowerCase().includes(recherche.toLowerCase()) ||
      (u.telephone && u.telephone.includes(recherche));
    return matchRole && matchTexte;
  });

  const nbAdmins = utilisateurs.filter((u) => u.role === "ADMINISTRATEUR").length;
  const nbPrestataires = utilisateurs.filter((u) => u.role === "PRESTATAIRE").length;

  return (
    <div className="space-y-6">
      {messageSucces && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{messageSucces}</span>
        </div>
      )}

      {/* Cartes KPI Utilisateurs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Utilisateurs
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 chiffres-tabulaires">
            {utilisateurs.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Comptes enregistrés</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Équipe & Admins
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 chiffres-tabulaires">
            {nbAdmins}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Droits d&apos;administration complets</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Partenaires & Prestataires
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 chiffres-tabulaires">
            {nbPrestataires}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Comptes partenaires actifs</p>
        </div>
      </div>

      {/* Barre d'outils (Recherche, Filtres par rôle, Bouton Ajouter) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { cle: "TOUS", label: "Tous les rôles" },
            { cle: "ADMINISTRATEUR", label: "Administrateurs" },
            { cle: "PRESTATAIRE", label: "Prestataires" },
          ].map((f) => (
            <button
              key={f.cle}
              type="button"
              onClick={() => setFiltreRole(f.cle)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filtreRole === f.cle
                  ? "bg-[#001D35] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher par nom ou e-mail..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
            />
          </div>

          <button
            type="button"
            onClick={() => setModalOuvert(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#001D35] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#002B4F] cursor-pointer"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            <span className="whitespace-nowrap">Ajouter un utilisateur</span>
          </button>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4">Utilisateur</th>
                <th scope="col" className="px-6 py-4">Rôle</th>
                <th scope="col" className="px-6 py-4">Statut</th>
                <th scope="col" className="px-6 py-4">Création</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {utilisateursFiltres.map((user) => {
                const initiales = user.nom
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-800 text-xs">
                          {initiales}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900">{user.nom}</span>
                          <span className="block text-[11px] text-slate-400">{user.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role === "ADMINISTRATEUR" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                          <ShieldCheck className="h-3 w-3 text-amber-600" />
                          Administrateur
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                          <UserCheck className="h-3 w-3 text-emerald-600" />
                          Prestataire
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {user.creeLe}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => alert(`Gestion du compte ${user.email}`)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                        title="Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'ajout d'utilisateur */}
      {modalOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Ajouter un nouvel utilisateur
              </h3>
              <button
                type="button"
                onClick={() => setModalOuvert(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAjoutUtilisateur} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aïssatou Diop"
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  required
                  placeholder="nom@domaine.sn"
                  value={nouveauEmail}
                  onChange={(e) => setNouveauEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Rôle attribué
                </label>
                <select
                  value={nouveauRole}
                  onChange={(e) => setNouveauRole(e.target.value as "ADMINISTRATEUR" | "PRESTATAIRE")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#001D35] focus:outline-none focus:ring-2 focus:ring-[#001D35]/10"
                >
                  <option value="ADMINISTRATEUR">Administrateur (Gestion complète)</option>
                  <option value="PRESTATAIRE">Prestataire Partenaire</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOuvert(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#001D35] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#002B4F]"
                >
                  Créer l&apos;accès
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
