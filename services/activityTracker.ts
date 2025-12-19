// Service pour envoyer les activités SignEase vers Supabase
// Permet le tracking sur le dashboard FO Metaux

import { supabase, isSupabaseConfigured } from '../config/supabase';

export type ActivityType = 'document_created' | 'document_sent' | 'document_signed' | 'document_rejected';

interface ActivityData {
  userEmail: string;
  userName?: string;
  actionType: ActivityType;
  documentName?: string;
  recipientEmail?: string;
  recipientName?: string;
  envelopeId?: string;
  metadata?: Record<string, any>;
}

/**
 * Enregistre une activité SignEase dans Supabase
 * Cette fonction est silencieuse - elle ne bloque pas l'utilisateur en cas d'erreur
 */
export const trackActivity = async (data: ActivityData): Promise<boolean> => {
  if (!supabase || !isSupabaseConfigured) {
    console.warn('⚠️ Supabase non configuré - activité non trackée');
    return false;
  }

  try {
    const { error } = await supabase
      .from('signease_activity')
      .insert({
        user_email: data.userEmail,
        user_name: data.userName || data.userEmail.split('@')[0],
        action_type: data.actionType,
        document_name: data.documentName,
        recipient_email: data.recipientEmail,
        recipient_name: data.recipientName,
        envelope_id: data.envelopeId,
        metadata: data.metadata || {}
      });

    if (error) {
      console.error('❌ Erreur tracking activité:', error);
      return false;
    }

    console.log(`✅ Activité trackée: ${data.actionType} - ${data.documentName || 'Sans titre'}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur tracking activité:', error);
    return false;
  }
};

/**
 * Track: Document créé (brouillon)
 */
export const trackDocumentCreated = (userEmail: string, documentName: string, metadata?: Record<string, any>) => {
  return trackActivity({
    userEmail,
    actionType: 'document_created',
    documentName,
    metadata
  });
};

/**
 * Track: Document envoyé pour signature
 */
export const trackDocumentSent = (
  userEmail: string, 
  documentName: string, 
  recipientEmail: string, 
  recipientName?: string,
  envelopeId?: string
) => {
  return trackActivity({
    userEmail,
    actionType: 'document_sent',
    documentName,
    recipientEmail,
    recipientName,
    envelopeId
  });
};

/**
 * Track: Document signé
 */
export const trackDocumentSigned = (
  signerEmail: string, 
  documentName: string, 
  envelopeId?: string,
  metadata?: Record<string, any>
) => {
  return trackActivity({
    userEmail: signerEmail,
    actionType: 'document_signed',
    documentName,
    envelopeId,
    metadata
  });
};

/**
 * Track: Document rejeté
 */
export const trackDocumentRejected = (
  signerEmail: string, 
  documentName: string, 
  reason?: string,
  envelopeId?: string
) => {
  return trackActivity({
    userEmail: signerEmail,
    actionType: 'document_rejected',
    documentName,
    envelopeId,
    metadata: { rejectionReason: reason }
  });
};
