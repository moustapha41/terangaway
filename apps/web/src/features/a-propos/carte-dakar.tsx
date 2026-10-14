"use client";

import { CarteTuiles } from "@/lib/carte/carte-tuiles";

/**
 * Situe Dakar sur la côte ouest-africaine — maquette a_propos, bloc « notre histoire ».
 *
 * Carte d'illustration : zoom large imposé, aucune interaction. Un visiteur qui
 * ne connaît pas le Sénégal voit où il va ; celui qui le connaît n'a rien à y
 * manipuler.
 */
const DAKAR = { latitude: 14.7167, longitude: -17.4677 };

export function CarteDakar({ etiquette }: { etiquette: string }) {
  return (
    <div className="hidden lg:block">
      <CarteTuiles
        statique
        zoomForce={5}
        etiquette={etiquette}
        className="aspect-square w-full"
        reperes={[{ id: "dakar", ...DAKAR, libelle: "Dakar", actif: true }]}
      />
      <p className="mt-2 text-legende text-encre-douce">Dakar · Sénégal</p>
    </div>
  );
}
