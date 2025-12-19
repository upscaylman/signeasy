// Configuration Supabase pour le tracking des utilisateurs actifs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Vérifier que la configuration est complète
const isConfigComplete = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined';

if (!isConfigComplete) {
  console.warn('⚠️ Configuration Supabase incomplète. Le tracking des utilisateurs sera désactivé.');
}

// Créer le client Supabase
export const supabase = isConfigComplete 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = isConfigComplete;
