import type { Request } from "express";

/**
 * Détermine si une adresse IP est privée, de bouclage local ou interne Docker (RFC 1918, RFC 4193).
 */
export function estIpPriveeOuInterne(ip: string): boolean {
  const propre = ip.trim().replace(/^::ffff:/, ""); // Normaliser IPv4-mapped IPv6
  if (propre === "127.0.0.1" || propre === "::1" || propre === "localhost") return true;
  // 10.0.0.0/8
  if (/^10\./.test(propre)) return true;
  // 172.16.0.0/12 (réseaux Docker et conteneurs internes)
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(propre)) return true;
  // 192.168.0.0/16
  if (/^192\.168\./.test(propre)) return true;
  // fc00::/7 ou fe80::/10
  if (/^(fc|fd|fe80)/i.test(propre)) return true;
  return false;
}

/**
 * Extrait l'adresse IP cliente fiable derrière un reverse proxy (Traefik) et Next.js.
 * 
 * Sécurité anti-usurpation (Anti-Spoofing) :
 * Les proxies inverses fiables (Traefik) ajoutent l'IP de la socket entrante à l'extrémité DROITE
 * de l'en-tête X-Forwarded-For. Un attaquant externe peut injecter une fausse IP à gauche
 * (`X-Forwarded-For: 1.2.3.4`), ce qui donne `X-Forwarded-For: 1.2.3.4, <vrai_client_ip>`.
 * Prendre le premier élément (`split(',')[0]`) permettrait à l'attaquant d'usurper n'importe quelle IP.
 * 
 * Cette fonction inspecte donc les adresses de droite à gauche, écarte les nœuds internes de confiance
 * (proxies internes Docker), et retient la première adresse IP externe légitime.
 */
export function extraireIpClientSecurisee(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    const ips = xForwardedFor.split(",").map((s) => s.trim().replace(/^::ffff:/, "")).filter(Boolean);
    // Parcourt de droite à gauche pour trouver le premier client non interne
    for (let i = ips.length - 1; i >= 0; i--) {
      const ipCandidate = ips[i];
      if (!estIpPriveeOuInterne(ipCandidate)) {
        return ipCandidate;
      }
    }
    // Si toutes les adresses sont sur le réseau privé (ex: dev local, tests CI)
    return ips[0];
  }

  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return xRealIp.trim().replace(/^::ffff:/, "");
  }

  const ipDirecte = (req.ip || req.socket?.remoteAddress || "127.0.0.1").replace(/^::ffff:/, "");
  return ipDirecte;
}
