/**
 * Jeu d'icônes unique (dossier de conception §A.6) : trait de 1,5 px, grille 24 × 24,
 * 20 px dans les lignes de détail. Les noms sont ceux du dossier, pas ceux de lucide,
 * pour qu'un changement de bibliothèque ne touche qu'ici.
 *
 * Règle : une icône d'action est toujours accompagnée d'un mot, sauf retour,
 * fermeture et recherche.
 */
import {
  AlertTriangle, ArrowLeft, Baby, BadgeCheck, Bath, BedDouble, Briefcase, CalendarDays,
  Camera, Compass, Ticket, Sparkles, Star, Globe, Target, TrendingUp, Mail,
  Car, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock,
  Flag, Headphones, House, Info, Luggage, MapPin, MessageCircle, Minus, Phone,
  Plane, Plus, Search, ShowerHead, SlidersHorizontal, Snowflake, Sun, Tag, Tv, Users,
  UtensilsCrossed, Waves, WashingMachine, Wifi, WifiOff, Zap,
  X, XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ICONES = {
  logement: House,
  voiture: Car,
  taxi: Car,
  chauffeur: Users,
  personnes: Users,
  enfant: Baby,
  lit: BedDouble,
  "salle-de-bain": Bath,
  bagage: Luggage,
  valise: Briefcase,
  calendrier: CalendarDays,
  horloge: Clock,
  repere: MapPin,
  verification: BadgeCheck,
  telephone: Phone,
  whatsapp: MessageCircle,
  filtre: SlidersHorizontal,
  tri: SlidersHorizontal,
  recherche: Search,
  retour: ArrowLeft,
  fermeture: X,
  avion: Plane,
  climatisation: Snowflake,
  wifi: Wifi,
  piscine: Waves,
  cuisine: UtensilsCrossed,
  "eau-chaude": ShowerHead,
  "groupe-electrogene": Zap,
  tv: Tv,
  "lave-linge": WashingMachine,
  "balcon-terrasse": Sun,
  alerte: AlertTriangle,
  information: Info,
  assistance: Headphones,
  prix: Tag,
  restauration: UtensilsCrossed,
  visite: Camera,
  guide: Compass,
  evenement: Ticket,
  nouveaute: Sparkles,
  enveloppe: Mail,
  etoile: Star,
  globe: Globe,
  cible: Target,
  statistiques: TrendingUp,
  moins: Minus,
  plus: Plus,
  chevron: ChevronDown,
  "chevron-gauche": ChevronLeft,
  "chevron-droite": ChevronRight,
  "hors-connexion": WifiOff,
  // Statuts d'une demande
  "coche-cercle": CheckCircle2,
  "double-coche": CheckCheck,
  drapeau: Flag,
  croix: X,
  tiret: Minus,
  "croix-cercle": XCircle,
} satisfies Record<string, LucideIcon>;

export type NomIcone = keyof typeof ICONES;

export function Icone({
  nom,
  taille = 24,
  className,
}: {
  nom: NomIcone;
  /** 24 par défaut ; 20 dans les lignes de détail (§A.6). */
  taille?: 16 | 20 | 24 | 28 | 32;
  className?: string;
}) {
  const Composant = ICONES[nom];
  return (
    <Composant
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.5}
      width={taille}
      height={taille}
      className={className}
    />
  );
}
