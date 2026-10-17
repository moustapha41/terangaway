"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home, Globe, Radio } from "lucide-react";
import { useLangue, useT } from "@/lib/i18n/contexte";
import { avecLangue } from "@/lib/i18n/chemins";

export function TopbarAdmin() {
  const t = useT();
  const langue = useLangue();
  const pathname = usePathname();

  // Nettoyer le chemin pour déduire le fil d'Ariane
  const cheminSansLangue = pathname.replace(new RegExp(`^/${langue}`), "") || "/";
  const segments = cheminSansLangue.split("/").filter(Boolean);

  const miettes = [
    { label: "Admin", href: avecLangue(langue, "/admin") },
  ];

  if (segments.includes("demandes")) {
    miettes.push({ label: t("admin.navDemandes"), href: avecLangue(langue, "/admin/demandes") });
    const idSegment = segments[segments.indexOf("demandes") + 1];
    if (idSegment && idSegment !== "export") {
      miettes.push({ label: idSegment, href: avecLangue(langue, `/admin/demandes/${idSegment}`) });
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md">
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-slate-500">
        <Home className="h-3.5 w-3.5 text-slate-400" />
        {miettes.map((m, index) => {
          const estDernier = index === miettes.length - 1;
          return (
            <div key={m.href} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-slate-300" />
              {estDernier ? (
                <span className="font-semibold text-slate-900">{m.label}</span>
              ) : (
                <Link href={m.href} className="hover:text-slate-900 transition-colors">
                  {m.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Côté droit : Statut API et Langue */}
      <div className="flex items-center gap-4">
        {/* Pastille état API */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>Système synchronisé</span>
        </div>

        {/* Sélecteur de langue */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
          <Globe className="h-3.5 w-3.5 text-slate-400 ml-1 mr-0.5" />
          {(["fr", "en", "es"] as const).map((l) => (
            <Link
              key={l}
              href={`/${l}${cheminSansLangue}`}
              className={`rounded px-1.5 py-0.5 font-medium uppercase transition ${
                langue === l
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
