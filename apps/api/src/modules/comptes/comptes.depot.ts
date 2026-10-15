export interface CodeOtp {
  id?: string;
  destination: string;
  telephone?: string;
  code: string;
  expireLe: string;
  tentatives: number;
  ipAddress?: string;
}

export interface VerificationRateLimit {
  autorise: boolean;
  motif?: "cooldown" | "quota_destination" | "quota_ip";
  delaiRestantSecondes?: number;
}

export interface SessionVisiteur {
  id: string;
  destination?: string;
  telephone?: string;
  email?: string;
  creeLe: string;
  compteId?: string;
  token?: string;
}

export interface SessionPrestataire {
  id: string;
  telephone: string;
  creeLe: string;
  compteId?: string;
  token?: string;
}

export interface DepotComptes {
  enregistrerOtp(otp: CodeOtp): Promise<void>;
  otpPour(destination: string): Promise<CodeOtp | null>;
  incrementerTentatives?(destination: string): Promise<number>;
  consommerOtp(idOuDestination: string): Promise<boolean | void>;
  verifierRateLimit?(destination: string, ipAddress?: string): Promise<VerificationRateLimit>;
  creerSessionVisiteur(destination: string): Promise<SessionVisiteur>;
  sessionVisiteur(id: string): Promise<SessionVisiteur | null>;
  creerSessionPrestataire(telephone: string): Promise<SessionPrestataire>;
  sessionPrestataire(id: string): Promise<SessionPrestataire | null>;
  revoquerSession?(idOuToken: string): Promise<void>;
}
