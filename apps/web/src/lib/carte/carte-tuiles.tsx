"use client";

import { useEffect, useRef, useState } from "react";
import { TAILLE_TUILE, cadrePour, xDeLongitude, yDeLatitude } from "./mercator";

export interface Repere {
  id: string;
  latitude: number;
  longitude: number;
  libelle: string;
  actif?: boolean;
  onClick?: () => void;
}

/**
 * Carte à tuiles OpenStreetMap, sans bibliothèque.
 *
 * Elle fait trois choses : afficher les tuiles autour d'un centre, poser des
 * repères cliquables, et se laisser déplacer à la souris, au doigt et au clavier.
 * Elle ne fait pas de rotation, pas de vecteurs, pas de clustering — la V1 n'en
 * a pas besoin, et le dossier reporte la carte après le MVP.
 *
 * L'attribution OSM est obligatoire ; elle est affichée en bas à droite.
 */
export function CarteTuiles({
  reperes,
  className,
  etiquette,
  zoomForce,
  statique = false,
}: {
  reperes: Repere[];
  className?: string;
  etiquette: string;
  /** Impose un niveau de zoom au lieu de cadrer sur les repères. */
  zoomForce?: number;
  /** Carte d'illustration : ni déplacement, ni clavier, ni repères cliquables. */
  statique?: boolean;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState({ largeur: 800, hauteur: 520 });
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const glisse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = boite.current;
    if (!element) return;
    const mesurer = () =>
      setTaille({ largeur: element.clientWidth, hauteur: element.clientHeight });
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  // Un changement de repères recadre : on ne garde pas un déplacement qui
  // porterait sur des résultats qui ne sont plus là.
  useEffect(() => setDecalage({ x: 0, y: 0 }), [reperes.map((r) => r.id).join(",")]);

  const { largeur, hauteur } = taille;
  const cadre = cadrePour(reperes, largeur, hauteur);
  const centre = cadre.centre;
  const zoom = zoomForce ?? cadre.zoom;

  const centreX = xDeLongitude(centre.longitude, zoom) * TAILLE_TUILE - decalage.x;
  const centreY = yDeLatitude(centre.latitude, zoom) * TAILLE_TUILE - decalage.y;

  // Tuiles nécessaires pour couvrir le cadre, avec une rangée de marge.
  const gauche = Math.floor((centreX - largeur / 2) / TAILLE_TUILE) - 1;
  const haut = Math.floor((centreY - hauteur / 2) / TAILLE_TUILE) - 1;
  const colonnes = Math.ceil(largeur / TAILLE_TUILE) + 3;
  const lignes = Math.ceil(hauteur / TAILLE_TUILE) + 3;
  const maximum = 2 ** zoom;

  const tuiles: { x: number; y: number; gauche: number; haut: number }[] = [];
  for (let i = 0; i < colonnes; i++) {
    for (let j = 0; j < lignes; j++) {
      const x = gauche + i;
      const y = haut + j;
      if (y < 0 || y >= maximum) continue;
      tuiles.push({
        x: ((x % maximum) + maximum) % maximum,
        y,
        gauche: x * TAILLE_TUILE - centreX + largeur / 2,
        haut: y * TAILLE_TUILE - centreY + hauteur / 2,
      });
    }
  }

  const deplacer = (dx: number, dy: number) =>
    setDecalage((d) => ({ x: d.x - dx, y: d.y - dy }));

  return (
    <div
      ref={boite}
      // En mode statique la carte est une illustration : elle ne prend pas le
      // focus et ne s'annonce pas comme une application manipulable, sinon on
      // promet au clavier une interaction qui n'existe pas.
      role={statique ? "img" : "application"}
      aria-label={etiquette}
      tabIndex={statique ? undefined : 0}
      onPointerDown={(e) => {
        if (statique) return;
        glisse.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (statique || !glisse.current) return;
        deplacer(e.clientX - glisse.current.x, e.clientY - glisse.current.y);
        glisse.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (glisse.current = null)}
      onKeyDown={(e) => {
        if (statique) return;
        const pas = 80;
        if (e.key === "ArrowLeft") deplacer(pas, 0);
        if (e.key === "ArrowRight") deplacer(-pas, 0);
        if (e.key === "ArrowUp") deplacer(0, pas);
        if (e.key === "ArrowDown") deplacer(0, -pas);
      }}
      className={
        "relative overflow-hidden rounded-card border border-contour bg-champ " +
        (statique ? "" : "touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire ") +
        (className ?? "")
      }
    >
      {tuiles.map((tuile) => (
        // Tuiles raster OSM : `next/image` n'a rien à optimiser, elles sont déjà
        // découpées et servies par un tiers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${zoom}-${tuile.x}-${tuile.y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${tuile.x}/${tuile.y}.png`}
          alt=""
          width={TAILLE_TUILE}
          height={TAILLE_TUILE}
          loading="lazy"
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: tuile.gauche, top: tuile.haut }}
        />
      ))}

      {reperes.map((repere) => {
        const x = xDeLongitude(repere.longitude, zoom) * TAILLE_TUILE - centreX + largeur / 2;
        const y = yDeLatitude(repere.latitude, zoom) * TAILLE_TUILE - centreY + hauteur / 2;
        return (
          <button
            key={repere.id}
            type="button"
            onClick={repere.onClick}
            style={{ left: x, top: y }}
            className={
              "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-pill px-3 py-1.5 " +
              "text-petit font-semibold shadow-[0_4px_12px_-2px_rgb(2_20_38/0.35)] " +
              "chiffres-tabulaires transition-colors " +
              (repere.actif
                ? "bg-accent text-primaire"
                : "bg-primaire text-white hover:bg-primaire/90")
            }
          >
            {repere.libelle}
          </button>
        );
      })}

      <p className="absolute bottom-1 right-1 z-10 rounded bg-surface/85 px-1.5 py-0.5 text-[10px] text-encre-douce">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}
