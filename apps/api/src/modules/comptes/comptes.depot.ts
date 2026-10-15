export interface CodeOtp {
  telephone: string;
  code: string;
  expireLe: string;
  tentatives: number;
}

export interface SessionVisiteur {
  id: string;
  telephone: string;
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
  otpPour(telephone: string): Promise<CodeOtp | null>;
  incrementerTentatives?(telephone: string): Promise<number>;
  consommerOtp(telephone: string): Promise<void>;
  creerSessionVisiteur(telephone: string): Promise<SessionVisiteur>;
  sessionVisiteur(id: string): Promise<SessionVisiteur | null>;
  creerSessionPrestataire(telephone: string): Promise<SessionPrestataire>;
  sessionPrestataire(id: string): Promise<SessionPrestataire | null>;
  revoquerSession?(idOuToken: string): Promise<void>;
}
