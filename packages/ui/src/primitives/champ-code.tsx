"use client";

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "../cn";

export type EtatCode = "vide" | "erreur" | "expire" | "verification";

/**
 * Champ de code — six cases, clavier numérique, collage accepté (§C.3).
 * États : vide, erreur, expiré, vérification.
 *
 * Le collage est traité explicitement : un code arrive par SMS, et le geste
 * naturel est de coller les six chiffres d'un coup. Sans ce traitement, seul le
 * premier chiffre entrerait — c'est le défaut classique de ce composant.
 */
export function ChampCode({
  libelle,
  longueur = 6,
  etat = "vide",
  message,
  valeur,
  onChange,
  className,
}: {
  libelle: string;
  longueur?: number;
  etat?: EtatCode;
  /** Message sous le champ : l'erreur est écrite, pas seulement signalée (§C.6). */
  message?: string;
  valeur: string;
  onChange: (valeur: string) => void;
  className?: string;
}) {
  const id = useId();
  const cases = useRef<Array<HTMLInputElement | null>>([]);
  const [focus, setFocus] = useState(0);

  const enErreur = etat === "erreur" || etat === "expire";
  const chiffres = valeur.padEnd(longueur, " ").slice(0, longueur).split("");

  const ecrire = (index: number, brut: string) => {
    const chiffre = brut.replace(/\D/g, "").slice(-1);
    if (!chiffre) return;
    const suivant = chiffres.map((c, i) => (i === index ? chiffre : c)).join("").trimEnd();
    onChange(suivant);
    cases.current[Math.min(index + 1, longueur - 1)]?.focus();
  };

  const toucher = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const suivant = chiffres.map((c, i) => (i === index ? " " : c)).join("").trimEnd();
      onChange(suivant);
      if (!chiffres[index].trim()) cases.current[Math.max(index - 1, 0)]?.focus();
    }
    if (e.key === "ArrowLeft") cases.current[Math.max(index - 1, 0)]?.focus();
    if (e.key === "ArrowRight") cases.current[Math.min(index + 1, longueur - 1)]?.focus();
  };

  const coller = (e: ClipboardEvent<HTMLInputElement>) => {
    const colle = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, longueur);
    if (!colle) return;
    e.preventDefault();
    onChange(colle);
    cases.current[Math.min(colle.length, longueur - 1)]?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span id={id} className="text-petit text-encre">
        {libelle}
      </span>

      <div role="group" aria-labelledby={id} aria-describedby={message ? `${id}-aide` : undefined} className="flex gap-2">
        {chiffres.map((chiffre, i) => (
          <input
            key={i}
            ref={(element) => {
              cases.current[i] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={chiffre.trim()}
            disabled={etat === "verification"}
            aria-label={`${libelle} — ${i + 1}`}
            aria-invalid={enErreur || undefined}
            onChange={(e) => ecrire(i, e.target.value)}
            onKeyDown={(e) => toucher(i, e)}
            onPaste={coller}
            onFocus={() => setFocus(i)}
            className={cn(
              "h-[56px] w-[44px] rounded-control border bg-surface text-center text-titre-2 text-encre",
              "chiffres-tabulaires outline-none transition-colors duration-[var(--duree-fast)]",
              "disabled:bg-champ disabled:text-encre-douce",
              // Pas de bordure de focus pendant la vérification : les cases sont
              // désactivées, un cadre actif y serait trompeur.
              enErreur
                ? "border-danger"
                : etat !== "verification" && focus === i
                  ? "border-primaire"
                  : "border-contour-champ",
            )}
          />
        ))}
      </div>

      {message && (
        <p id={`${id}-aide`} className={cn("text-petit", enErreur ? "text-danger" : "text-encre-douce")}>
          {message}
        </p>
      )}
    </div>
  );
}
