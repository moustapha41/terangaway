"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  Globe,
  Radio,
  Sliders,
  UserCheck,
} from "lucide-react";
import type { CompteAdministrateur } from "@teranga/contracts";
import { deconnexionAdminAction } from "./actions";
import { useT, useLangue } from "@/lib/i18n/contexte";
import { useNaviguer } from "@/lib/i18n/naviguer";
import { avecLangue } from "@/lib/i18n/chemins";
import { Logo } from "@/components/layout/logo";

interface NavbarAdminProps {
  compte: CompteAdministrateur | null;
}

export function NavbarAdmin({ compte }: NavbarAdminProps) {
  const t = useT();
  const langue = useLangue();
  const pathname = usePathname();
  const naviguer = useNaviguer();
  const [mobileMenuOuvert, setMobileMenuOuvert] = useState(false);
  const [menuReglagesOuvert, setMenuReglagesOuvert] = useState(false);
  const [enCoursDeconnexion, demarrerDeconnexion] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  const cheminSansLangue = pathname.replace(new RegExp(`^/${langue}`), "") || "/";
  const estTableauDeBord = cheminSansLangue === "/admin" || cheminSansLangue === "/admin/";
  const estDemandes = cheminSansLangue.startsWith("/admin/demandes");
  const estUtilisateurs = cheminSansLangue.startsWith("/admin/utilisateurs");
  const estParametres = cheminSansLangue.startsWith("/admin/parametres");

  const lienTableauDeBord = avecLangue(langue, "/admin");
  const lienDemandes = avecLangue(langue, "/admin/demandes");
  const lienUtilisateurs = avecLangue(langue, "/admin/utilisateurs");
  const lienParametres = avecLangue(langue, "/admin/parametres");
  const lienSitePublic = avecLangue(langue, "/");

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function clicExterieur(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuReglagesOuvert(false);
      }
    }
    document.addEventListener("mousedown", clicExterieur);
    return () => document.removeEventListener("mousedown", clicExterieur);
  }, []);

  const navigations = [
    {
      label: t("admin.navTableauDeBord"),
      href: lienTableauDeBord,
      actif: estTableauDeBord,
      icone: LayoutDashboard,
    },
    {
      label: t("admin.navDemandes"),
      href: lienDemandes,
      actif: estDemandes,
      icone: ClipboardList,
    },
    {
      label: t("admin.navUtilisateurs"),
      href: lienUtilisateurs,
      actif: estUtilisateurs,
      icone: Users,
    },
    {
      label: t("admin.navParametres"),
      href: lienParametres,
      actif: estParametres,
      icone: Settings,
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

  const handleDeconnexion = () => {
    demarrerDeconnexion(async () => {
      await deconnexionAdminAction();
      naviguer("/admin/connexion");
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#001427] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 1. Logo & Console Badge */}
        <div className="flex items-center gap-6">
          <Link href={lienTableauDeBord} className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm transition-transform group-hover:scale-105">
              <Logo forme="marque" variante="clair" hauteur={26} />
            </div>
            <div>
              <span className="block font-bold tracking-tight text-white text-base leading-none">
                Teranga Way
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 mt-0.5">
                <ShieldCheck className="h-3 w-3" />
                Console Admin
              </span>
            </div>
          </Link>

          {/* 2. Navigation Desktop (Onglets horizontaux) */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navigations.map((item) => {
              const Icone = item.icone;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    item.actif
                      ? "bg-amber-400 text-[#001427] shadow-sm font-bold"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icone className={`h-4 w-4 ${item.actif ? "text-[#001427]" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 3. Contrôles de droite : Statut API, Langue, Menu Settings / Profil */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Statut API */}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="hidden lg:inline">En direct</span>
          </div>

          {/* Sélecteur de langue */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-[11px]">
            <Globe className="h-3 w-3 text-slate-400 ml-1 mr-0.5" />
            {(["fr", "en", "es"] as const).map((l) => (
              <Link
                key={l}
                href={`/${l}${cheminSansLangue}`}
                className={`rounded px-1.5 py-0.5 font-semibold uppercase transition ${
                  langue === l
                    ? "bg-amber-400 text-[#001427] shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>

          {/* Menu Dropdown Paramètres & Profil Utilisateur */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuReglagesOuvert(!menuReglagesOuvert)}
              className={`flex items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-xs transition ${
                menuReglagesOuvert || estParametres || estUtilisateurs
                  ? "border-amber-400 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 font-bold text-[#001427] text-xs shadow-sm">
                {initiales}
              </div>
              <span className="hidden md:inline font-semibold max-w-[120px] truncate text-left">
                {compte?.nom || "Admin"}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${menuReglagesOuvert ? "rotate-180" : ""}`} />
            </button>

            {menuReglagesOuvert && (
              <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95">
                {/* En-tête profil */}
                <div className="border-b border-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {compte?.nom || "Administrateur"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {compte?.email || "Équipe Teranga"}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                    <ShieldCheck className="h-3 w-3" />
                    Rôle Administrateur
                  </span>
                </div>

                {/* Liens de gestion */}
                <div className="py-1">
                  <Link
                    href={lienParametres}
                    onClick={() => setMenuReglagesOuvert(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Sliders className="h-4 w-4 text-slate-400" />
                    <span>Paramètres du système</span>
                  </Link>

                  <Link
                    href={lienUtilisateurs}
                    onClick={() => setMenuReglagesOuvert(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <UserCheck className="h-4 w-4 text-slate-400" />
                    <span>Gestion des utilisateurs</span>
                  </Link>

                  <Link
                    href={lienSitePublic}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuReglagesOuvert(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <div className="flex items-center gap-2.5">
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                      <span>Voir le site public</span>
                    </div>
                    <span className="text-[10px] text-slate-400">↗</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    disabled={enCoursDeconnexion}
                    onClick={handleDeconnexion}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>{enCoursDeconnexion ? "Déconnexion..." : t("admin.deconnexion")}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bouton Hamburger Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOuvert(!mobileMenuOuvert)}
            className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Ouvrir le menu"
          >
            {mobileMenuOuvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu Déroulant Mobile */}
      {mobileMenuOuvert && (
        <div className="border-t border-white/10 bg-[#001427] px-4 py-4 md:hidden">
          <nav className="space-y-1">
            {navigations.map((item) => {
              const Icone = item.icone;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOuvert(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    item.actif
                      ? "bg-amber-400 text-[#001427]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icone className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 font-bold text-[#001427] text-xs">
                  {initiales}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{compte?.nom || "Admin"}</p>
                  <p className="text-[10px] text-slate-400">{compte?.email}</p>
                </div>
              </div>

              {/* Langue mobile */}
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-[11px]">
                {(["fr", "en", "es"] as const).map((l) => (
                  <Link
                    key={l}
                    href={`/${l}${cheminSansLangue}`}
                    className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                      langue === l ? "bg-amber-400 text-[#001427]" : "text-slate-400"
                    }`}
                  >
                    {l}
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={enCoursDeconnexion}
              onClick={handleDeconnexion}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 py-2.5 text-xs font-semibold text-red-200 hover:bg-red-500/30"
            >
              <LogOut className="h-4 w-4" />
              <span>{enCoursDeconnexion ? "Déconnexion..." : t("admin.deconnexion")}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
