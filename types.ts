
export enum DocumentStatus {
  DRAFT = 'Brouillon',
  SENT = 'Envoyé',
  SIGNED = 'Signé',
  REJECTED = 'Rejeté',
}

export interface Document {
  id: string;
  name: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  totalPages: number;
  rejectionReason?: string;
  expiresAt: string; // Date d'expiration (1 an après création)
  creatorEmail: string; // Email de l'expéditeur (pour notifications)
  archived?: boolean; // Document archivé par l'expéditeur
}

export enum FieldType {
  SIGNATURE = 'Signature',
  INITIAL = 'Paraphe',
  DATE = 'Date',
  TEXT = 'Texte',
  CHECKBOX = 'Case à cocher',
}

export interface Field {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  recipientId: string;
  value?: string | boolean | null;
  signatureSubType?: 'signature' | 'initial'; // Sous-type pour FieldType.SIGNATURE : 'signature' (dessiner) ou 'initial' (taper)
  parapheGroupId?: string; // ID de groupe pour synchroniser les paraphes sur toutes les pages
  textOptions?: {
    fontSize?: number; // Taille de police en px
    lineHeight?: number; // Hauteur de ligne
    wordWrap?: boolean; // Retour à la ligne automatique
  };
}

export interface Recipient {
  id:string;
  name: string;
  email: string;
  signingOrder: number;
}

export interface Envelope {
  id: string;
  document: Document;
  recipients: Recipient[];
  fields: Field[];
}

export interface MockEmail {
  id: string;
  from: string;
  to: string;
  toName?: string;
  toEmail?: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
  signatureLink: string;
  documentName: string;
}

export interface AuditEvent {
  timestamp: string;
  action: string;
  user?: string;
  ip?: string;
  type: 'CREATE' | 'SEND' | 'SIGN' | 'REJECT' | 'COMPLETE' | 'TIMESTAMP';
  reason?: string;
  recipients?: string[];
  // Fix: Add missing optional properties for timestamping authority and final document hash.
  tsa?: string;
  finalHash?: string;
}