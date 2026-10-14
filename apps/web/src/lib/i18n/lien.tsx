"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { avecLangue } from "./chemins";
import { useLangue } from "./contexte";

/**
 * Lien interne : il porte toujours la langue courante.
 *
 * C'est la raison d'être du composant. Les `href` écrits à la main sortaient du
 * segment de langue dès le premier clic.
 */
export function Lien({ href, ...reste }: ComponentProps<typeof Link> & { href: string }) {
  const langue = useLangue();
  return <Link href={avecLangue(langue, href)} {...reste} />;
}
