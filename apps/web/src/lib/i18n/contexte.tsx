"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { creerTraducteur, type Catalogue, type Traducteur } from "./traducteur";
import { LANGUE_DEFAUT, type Langue } from "./langues";

const Contexte = createContext<{ langue: Langue; t: Traducteur } | null>(null);

export function FournisseurLangue({
  langue,
  messages,
  children,
}: {
  langue: Langue;
  /** Le catalogue de la langue active, sérialisé par le layout. */
  messages: Catalogue;
  children: ReactNode;
}) {
  const valeur = useMemo(
    () => ({ langue, t: creerTraducteur(messages, langue) }),
    [langue, messages],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

function contexte() {
  const valeur = useContext(Contexte);
  if (!valeur) {
    throw new Error("FournisseurLangue manque au-dessus de ce composant.");
  }
  return valeur;
}

/** Traduire depuis un composant client. Côté serveur : `traducteurPour(langue)`. */
export function useT(): Traducteur {
  return contexte().t;
}

export function useLangue(): Langue {
  return contexte().langue;
}
