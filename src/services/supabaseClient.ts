import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { sanitizePostgrestIdentifier } from '../utils/cryptoSecurity';

/**
 * Configuration Supabase pour Vitax.
 * Les clés sont chargées depuis les variables d'environnement EXPO_PUBLIC_* ou la configuration Expo (app.json extra).
 */
export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';

export const SUPABASE_ANON_KEY: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_ANON_KEY.length > 20
  );
};

let clientInstance: SupabaseClient | null = null;
let activeUserIdInMemory: string | null = null;
let sessionHydrated = false;

/**
 * Définit l'identifiant d'athlète actif pour l'en-tête de contexte RLS (x-client-info)
 */
export function setSupabaseActiveUserId(userId: string | null): void {
  activeUserIdInMemory = sanitizePostgrestIdentifier(userId);
  sessionHydrated = true;
}

async function resolveActiveUserId(): Promise<string | null> {
  if (activeUserIdInMemory) {
    return activeUserIdInMemory;
  }
  if (sessionHydrated) {
    return null;
  }
  try {
    const rawSession = await AsyncStorage.getItem('@vitax_auth_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.userId) {
        activeUserIdInMemory = sanitizePostgrestIdentifier(parsed.userId);
        sessionHydrated = true;
        return activeUserIdInMemory;
      }
    }
    const rawProfile = await AsyncStorage.getItem('@vitax_trainer_profile');
    if (rawProfile) {
      const parsedProf = JSON.parse(rawProfile);
      if (parsedProf?.id) {
        activeUserIdInMemory = sanitizePostgrestIdentifier(parsedProf.id);
      }
    }
  } catch {
    // Ignorer silencieusement en cas d'erreur de lecture initiale
  }
  sessionHydrated = true;
  return activeUserIdInMemory;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const uid = await resolveActiveUserId();
          const headers = new Headers(init?.headers);
          if (uid) {
            const existingInfo = headers.get('x-client-info') || 'vitax-pwa/1.0';
            if (!existingInfo.includes('uid=')) {
              headers.set('x-client-info', `${existingInfo};uid=${uid}`);
            }
          }

          // Protection anti-blocage réseau : timeout de 10s si aucun signal n'est fourni
          let signal = init?.signal;
          let timeoutId: any = null;
          if (!signal && typeof AbortController !== 'undefined') {
            const controller = new AbortController();
            signal = controller.signal;
            timeoutId = setTimeout(() => controller.abort(), 10000);
          }

          try {
            return await fetch(input, {
              ...init,
              headers,
              signal,
            });
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        },
      },
    });
  }

  return clientInstance;
}
