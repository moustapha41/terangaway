"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
  User,
  Sparkles,
} from "lucide-react";
import type { CompteAdministrateur } from "@teranga/contracts";
import { deconnexionAdminAction } from "./actions";
import { useT } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { avecLangue } from "@/lib/i18n/chemins";
import { useLangue } from "@/lib/i18n/contexte";
import { Logo } from "@/components/layout/logo";

interface SidebarAdminProps {
  compte: CompteAdministrateur | null;
}

export function SidebarAdmin({ compte }: SidebarAdminProps) {
  const t = useT();
  const langue = useLangue();
  const pathname = usePathname();
  const naviguer = useNaviguer();
  const [mobileOuvert, setMobileOuvert] = useState(false);
  const [enCoursDeconnexion, demarrerDeconnexion] = useTransition();

  const cheminSansLangue = pathname.replace(new RegExp(`^/${langue}`), "") || "/";
  const estTableauDeBord = cheminSansLangue === "/admin" || cheminSansLangue === "/admin/";
  const estDemandes = cheminSansLangue.startsWith("/admin/demandes");

  const lienTableauDeBord = avecLangue(langue, "/admin");
  const lienDemandes = avecLangue(langue, "/admin/demandes");
  const lienSitePublic = avecLangue(langue, "/");

  const navigations = [
    {
      label: t("admin.navTableauDeBord"),
      href: lienTableauDeBord,
      actif: estTableauDeBord,
      icone: LayoutDashboard,
      description: "Vue d'ensemble & métriques",
    },
    {
      label: t("admin.navDemandes"),
      href: lienDemandes,
      actif: estDemandes,
      icone: ClipboardList,
      description: "Gestion des réservations",
    },
  ];

  const initiales = compte?.nom
    ? compte.nom
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : (compte?.email?.[0] || "A").toUpperCase();

  const contenuSidebar = (
    <div className="flex h-full flex-col justify-between bg-[#001427] text-white">
      {/* Haut : Logo & Marque */}
      <div>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <Link href={lienTableauDeBord} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
              <Logo forme="marque" variante="clair" hauteur={26} />
            </div>
            <div>
              <span className="block font-semibold tracking-tight text-white text-base leading-tight">
                Teranga Way
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                <ShieldCheck className="h-3 w-3" />
                Console Admin
              </span>
            </div>
          </Link>

          {/* Bouton fermeture sur mobile */}
          <button
            type="button"
            onClick={() => setMobileOuvert(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation principale */}
        <div className="px-3 py-6">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Gestion & Opérations
          </p>
          <nav className="space-y-1.5">
            {navigations.map((item) => {
              const Icone = item.icone;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOuvert(false)}
                  className={`group flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                    item.actif
                      ? "bg-amber-400 text-[#001427] shadow-lg shadow-amber-400/20 font-semibold"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icone
                      className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                        item.actif ? "text-[#001427]" : "text-slate-400 group-hover:text-amber-300"
                      }`}
                    />
                    <div>
                      <span className="block leading-tight">{item.label}</span>
                      <span
                        className={`block text-[11px] leading-tight ${
                          item.actif ? "text-[#001427]/80" : "text-slate-400"
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${
                      item.actif ? "text-[#001427] translate-x-0.5" : "text-slate-500 opacity-0 group-hover:opacity-100"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Raccourcis
            </p>
            <Link
              href={lienSitePublic}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="h-4 w-4 text-slate-400" />
                <span>Voir le site public</span>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                Visiteur
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bas : Profil & Déconnexion */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 font-bold text-[#001427] text-sm shadow-sm">
            {initiales}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {compte?.nom || "Administrateur"}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {compte?.email || "Équipe Teranga"}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={enCoursDeconnexion}
          onClick={() => {
            demarrerDeconnexion(async () => {
              await deconnexionAdminAction();
              naviguer("/admin/connexion");
            });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{enCoursDeconnexion ? "Déconnexion..." : t("admin.deconnexion")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Barre mobile supérieure avec bouton hamburger */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-[#001427] px-4 py-3 text-white lg:hidden">
        <Link href={lienTableauDeBord} className="flex items-center gap-2.5">
          <Logo forme="marque" variante="clair" hauteur={26} />
          <span className="font-semibold text-sm">Teranga Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOuvert(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Drawer mobile */}
      {mobileOuvert && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOuvert(false)}
          />
          <div className="relative flex w-72 max-w-[85vw] flex-col shadow-2xl">
            {contenuSidebar}
          </div>
        </div>
      )}

      {/* Sidebar Desktop fixe */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col shadow-xl">
        {contenuSidebar}
      </aside>
    </>
  );
}
