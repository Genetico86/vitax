import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { TrainerProfile, AuthSession } from '../types/social';
import { useSettingsStore } from '../stores/settingsStore';

export const STORAGE_KEY_AUTH_SESSION = '@vitax_auth_session';
export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';
export const STORAGE_KEY_CREDENTIALS = '@vitax_local_creds';

/**
 * Nettoie le nom d'utilisateur pour construire l'identifiant interne
 */
export function sanitizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');
}

/**
 * Génère un code ami au format VTX-XXXX (ex: VTX-4821)
 */
export function generateFriendCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `VTX-${digits}`;
}

/**
 * Récupère la session persistée silencieusement (sans redemander le mot de passe)
 */
export async function getPersistedSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erreur lecture session persistée:', e);
    return null;
  }
}

/**
 * Sauvegarde la session persistée
 */
export async function savePersistedSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(session));
}

/**
 * Inscription d'un nouveau Dresseur avec Nom d'utilisateur + Mot de passe
 * (Aucune mention de Supabase côté utilisateur)
 */
export async function registerTrainer(
  username: string,
  password: string
): Promise<{ success: boolean; profile?: TrainerProfile; error?: string }> {
  const trimmedName = username.trim();
  if (trimmedName.length < 2) {
    return { success: false, error: 'Le nom d’utilisateur doit comporter au moins 2 caractères.' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'Le mot de passe doit comporter au moins 4 caractères.' };
  }

  const cleanUser = sanitizeUsername(trimmedName);
  const internalEmail = `${cleanUser}@vitax.app`;
  const friendCode = generateFriendCode();
  const userId = `vtx_${Date.now()}_${cleanUser}`;

  const initialProfile: TrainerProfile = {
    id: userId,
    username: trimmedName,
    friendCode,
    trainerTitle: 'Dresseur Rookie',
    avatarPokemonId: 'pikachu',
    avatarPokemonEmoji: '⚡',
    currentLeague: 'pierre',
    totalXp: 0,
    totalWorkouts: 0,
    createdAt: new Date().toISOString(),
  };

  // 1. Enregistrement Supabase si configuré
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
        });

        if (authError && !authError.message.includes('already registered')) {
          console.warn('Erreur Supabase signUp:', authError.message);
        }

        const effectiveUserId = authData?.user?.id || userId;
        initialProfile.id = effectiveUserId;

        // Upsert dans la table profiles
        await supabase.from('profiles').upsert({
          id: effectiveUserId,
          username: trimmedName,
          friend_code: friendCode,
          trainer_title: initialProfile.trainerTitle,
          avatar_pokemon_id: initialProfile.avatarPokemonId,
          avatar_pokemon_emoji: initialProfile.avatarPokemonEmoji,
          current_league: initialProfile.currentLeague,
          total_xp: 0,
          total_workouts: 0,
        });
      } catch (e: any) {
        console.warn('Connexion serveur indisponible, inscription locale sécurisée:', e?.message);
      }
    }
  }

  // 2. Sauvegarde locale persistante (Session + Profil + Identifiants)
  const session: AuthSession = {
    userId: initialProfile.id,
    username: trimmedName,
    friendCode: initialProfile.friendCode,
    isLoggedIn: true,
    createdAt: new Date().toISOString(),
  };

  await savePersistedSession(session);
  await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(initialProfile));
  await AsyncStorage.setItem(
    STORAGE_KEY_CREDENTIALS,
    JSON.stringify({ username: trimmedName, password })
  );

  // Synchroniser le nom dans le store pour la salutation
  try {
    await useSettingsStore.getState().setUserName(trimmedName);
  } catch (e) {
    console.warn('Erreur synchro store nom:', e);
  }

  return { success: true, profile: initialProfile };
}

/**
 * Connexion d'un Dresseur existant avec Nom d'utilisateur + Mot de passe
 */
export async function loginTrainer(
  username: string,
  password: string
): Promise<{ success: boolean; profile?: TrainerProfile; error?: string }> {
  const trimmedName = username.trim();
  if (!trimmedName || !password) {
    return { success: false, error: 'Veuillez saisir votre nom d’utilisateur et votre mot de passe.' };
  }

  const cleanUser = sanitizeUsername(trimmedName);
  const internalEmail = `${cleanUser}@vitax.app`;

  // 1. Tenter la connexion Supabase si configuré
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

        if (!authError && authData?.user) {
          // Récupérer le profil depuis Supabase
          const { data: remoteProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          const loadedProfile: TrainerProfile = remoteProfile
            ? {
                id: remoteProfile.id,
                username: remoteProfile.username || trimmedName,
                friendCode: remoteProfile.friend_code || generateFriendCode(),
                trainerTitle: remoteProfile.trainer_title || 'Athlète Vitax',
                avatarPokemonId: remoteProfile.avatar_pokemon_id || 'pikachu',
                avatarPokemonEmoji: remoteProfile.avatar_pokemon_emoji || '⚡',
                currentLeague: remoteProfile.current_league || 'pierre',
                totalXp: remoteProfile.total_xp || 0,
                totalWorkouts: remoteProfile.total_workouts || 0,
                createdAt: remoteProfile.created_at || new Date().toISOString(),
              }
            : {
                id: authData.user.id,
                username: trimmedName,
                friendCode: generateFriendCode(),
                trainerTitle: 'Athlète Vitax',
                avatarPokemonId: 'pikachu',
                avatarPokemonEmoji: '⚡',
                currentLeague: 'pierre',
                totalXp: 0,
                totalWorkouts: 0,
                createdAt: new Date().toISOString(),
              };

          const session: AuthSession = {
            userId: loadedProfile.id,
            username: loadedProfile.username,
            friendCode: loadedProfile.friendCode,
            token: authData.session?.access_token,
            isLoggedIn: true,
            createdAt: new Date().toISOString(),
          };

          await savePersistedSession(session);
          await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(loadedProfile));
          await AsyncStorage.setItem(
            STORAGE_KEY_CREDENTIALS,
            JSON.stringify({ username: trimmedName, password })
          );
          await useSettingsStore.getState().setUserName(trimmedName);

          return { success: true, profile: loadedProfile };
        }
      } catch (e: any) {
        console.warn('Tentative connexion serveur échouée, vérification locale:', e?.message);
      }
    }
  }

  // 2. Vérification locale (Mode hors-ligne ou compte sauvegardé)
  try {
    const rawCreds = await AsyncStorage.getItem(STORAGE_KEY_CREDENTIALS);
    if (rawCreds) {
      const creds = JSON.parse(rawCreds);
      if (
        sanitizeUsername(creds.username) === cleanUser &&
        creds.password === password
      ) {
        const rawProf = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
        let prof: TrainerProfile;
        if (rawProf) {
          prof = JSON.parse(rawProf);
        } else {
          prof = {
            id: `vtx_${cleanUser}`,
            username: trimmedName,
            friendCode: generateFriendCode(),
            trainerTitle: 'Dresseur Rookie',
            avatarPokemonId: 'pikachu',
            avatarPokemonEmoji: '⚡',
            currentLeague: 'pierre',
            totalXp: 0,
            totalWorkouts: 0,
            createdAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(prof));
        }

        const session: AuthSession = {
          userId: prof.id,
          username: prof.username,
          friendCode: prof.friendCode,
          isLoggedIn: true,
          createdAt: new Date().toISOString(),
        };

        await savePersistedSession(session);
        await useSettingsStore.getState().setUserName(trimmedName);
        return { success: true, profile: prof };
      }
    }
  } catch (err) {
    console.error('Erreur login local:', err);
  }

  return {
    success: false,
    error: 'Nom d’utilisateur ou mot de passe incorrect. Vérifiez vos identifiants.',
  };
}

/**
 * Restaure silencieusement la session active sans redemander le mot de passe
 */
export async function restoreSessionSilently(): Promise<TrainerProfile | null> {
  try {
    const session = await getPersistedSession();
    if (!session || !session.isLoggedIn) {
      return null;
    }

    const rawProf = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    if (rawProf) {
      const prof: TrainerProfile = JSON.parse(rawProf);
      // Synchroniser avec les réglages
      if (prof.username) {
        const currentName = useSettingsStore.getState().user_name;
        if (!currentName || currentName !== prof.username) {
          await useSettingsStore.getState().setUserName(prof.username);
        }
      }
      return prof;
    }

    return null;
  } catch (e) {
    console.error('Erreur restauration silencieuse session:', e);
    return null;
  }
}

/**
 * Déconnexion du compte dresseur
 */
export async function logoutTrainer(): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    }
    await AsyncStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
    // On conserve le profil en cache pour réutilisation rapide si besoin
  } catch (e) {
    console.error('Erreur logout:', e);
  }
}
