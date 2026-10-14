"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { avecLangue } from "./chemins";
import { useLangue } from "./contexte";

/**
 * `router.push` qui n'oublie pas la langue.
 *
 * Toutes les routes vivent sous `/[locale]/…`. Un `router.push("/logements")`
 * ne mène donc nulle part : en navigation client, le routeur ne trouve pas le
 * segment et **abandonne sans rien dire** — pas d'erreur, pas de page, rien.
 * Le middleware ne rattrape que les chargements complets, et au prix d'un
 * aller-retour qui relit la langue dans le cookie plutôt que dans l'URL : un
 * visiteur en espagnol pouvait atterrir en français.
 *
 * Ce point de passage unique rend l'oubli impossible.
 */
export function useNaviguer() {
  const router = useRouter();
  const langue = useLangue();

  return useCallback(
    (chemin: string) => router.push(avecLangue(langue, chemin)),
    [router, langue],
  );
}
