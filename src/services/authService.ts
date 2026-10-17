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
 * Génère un code ami unique à 5 chiffres (ex: 48219)
 */
export function generateFriendCode(): string {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `${digits}`;
}

/**
 * Génère un code ami à 5 chiffres vérifié comme disponible sur Supabase
 */
export async function generateUniqueFriendCode(): Promise<string> {
  let candidate = generateFriendCode();
  if (!isSupabaseConfigured()) return candidate;
  const supabase = getSupabaseClient();
  if (!supabase) return candidate;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('friend_code', candidate)
        .limit(1);
      if (!data || data.length === 0) {
        return candidate;
      }
      candidate = generateFriendCode();
    } catch {
      return candidate;
    }
  }
  return candidate;
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
 * Inscription d'un Athlète avec Nom d'utilisateur + Mot de passe
 * Enregistre le compte et son mot de passe directement dans public.profiles (consultable par l'administrateur dans Supabase)
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
  const friendCode = await generateUniqueFriendCode();
  const userId = `vtx_${cleanUser}`;

  const initialProfile: TrainerProfile = {
    id: userId,
    username: trimmedName,
    friendCode,
    trainerTitle: 'Athlète Vitax',
    avatarPokemonId: 'athlete',
    avatarPokemonEmoji: '⚡',
    avatarUrl: useSettingsStore.getState().avatar_url,
    currentLeague: 'pierre',
    totalXp: 0,
    totalWorkouts: 0,
    createdAt: new Date().toISOString(),
  };

  // 1. Enregistrement central dans Supabase (table public.profiles avec mot de passe lisible)
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // Vérifier si le nom d'utilisateur est déjà pris (insensible à la casse)
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', trimmedName);

        if (existing && existing.length > 0) {
          return {
            success: false,
            error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
          };
        }

        // Insérer le profil avec son mot de passe
        const insertPayload: any = {
          id: userId,
          username: trimmedName,
          password: password,
          friend_code: friendCode,
          trainer_title: initialProfile.trainerTitle,
          avatar_pokemon_id: initialProfile.avatarPokemonId,
          avatar_pokemon_emoji: initialProfile.avatarPokemonEmoji,
          current_league: initialProfile.currentLeague,
          total_xp: 0,
          total_workouts: 0,
          created_at: initialProfile.createdAt,
          updated_at: initialProfile.createdAt,
        };
        if (initialProfile.avatarUrl) {
          insertPayload.avatar_url = initialProfile.avatarUrl;
        }

        let { error: insertErr } = await supabase.from('profiles').insert(insertPayload);
        if (insertErr && (insertErr.message?.includes('avatar_url') || insertErr.code === '42703')) {
          delete insertPayload.avatar_url;
          const retry = await supabase.from('profiles').insert(insertPayload);
          insertErr = retry.error;
        }

        if (insertErr) {
          if (
            insertErr.code === '23505' ||
            insertErr.message.includes('unique') ||
            insertErr.message.includes('duplicate')
          ) {
            return {
              success: false,
              error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
            };
          }

          console.warn('Erreur insertion profil Supabase:', insertErr.message);
          // Si la colonne password n'existe pas encore dans Supabase, tenter sans bloquer
          if (insertErr.message.includes('password')) {
            const { error: fallbackErr } = await supabase.from('profiles').insert({
              id: userId,
              username: trimmedName,
              friend_code: friendCode,
              trainer_title: initialProfile.trainerTitle,
              avatar_pokemon_id: initialProfile.avatarPokemonId,
              avatar_pokemon_emoji: initialProfile.avatarPokemonEmoji,
              current_league: initialProfile.currentLeague,
              total_xp: 0,
              total_workouts: 0,
            });

            if (fallbackErr && (fallbackErr.code === '23505' || fallbackErr.message.includes('unique'))) {
              return {
                success: false,
                error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
              };
            }
          }
        }
      } catch (err: any) {
        console.warn('Exception inscription Supabase:', err?.message);
      }
    }
  }

  // Si un autre compte était précédemment connecté sur cet appareil, purger les données locales avant d'initialiser le nouveau compte
  try {
    const prevSession = await getPersistedSession();
    if (prevSession?.userId && prevSession.userId !== initialProfile.id) {
      const { clearUserLocalData } = await import('../database/db');
      await clearUserLocalData();
      await AsyncStorage.multiRemove([
        '@vitax_deleted_ids',
        '@vitax_active_workout_draft',
        '@vitax_favorite_exercise_ids',
        '@vitax_daily_bonus_state',
      ]);
    }
  } catch {}

  // 2. Persistance locale
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

  try {
    await useSettingsStore.getState().setUserName(trimmedName);
  } catch {}

  // Rapatrier / synchroniser avec le cloud
  try {
    const { syncCloudAndLocal } = await import('./cloudSyncService');
    void syncCloudAndLocal();
  } catch {}

  return { success: true, profile: initialProfile };
}

/**
 * Connexion d'un Athlète avec Nom d'utilisateur + Mot de passe
 * Vérifie les identifiants directement dans la table public.profiles de Supabase
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

  // 1. Vérification dans la base centrale Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: rows, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', trimmedName);

        if (!error && rows && rows.length > 0) {
          const userRecord = rows[0];

          // Si un mot de passe est enregistré dans Supabase, le vérifier
          if (userRecord.password && userRecord.password !== password) {
            return { success: false, error: 'Mot de passe incorrect.' };
          }

          // Si aucun mot de passe n'était encore renseigné (compte déjà existant), on l'enregistre maintenant
          if (!userRecord.password) {
            try {
              await supabase
                .from('profiles')
                .update({ password })
                .eq('id', userRecord.id);
            } catch {}
          }

          const safeCode =
            userRecord.friend_code && userRecord.friend_code !== '10000'
              ? userRecord.friend_code
              : generateFriendCode();

          if (!userRecord.friend_code || userRecord.friend_code === '10000') {
            try {
              await supabase
                .from('profiles')
                .update({ friend_code: safeCode })
                .eq('id', userRecord.id);
            } catch {}
          }

          const loadedProfile: TrainerProfile = {
            id: userRecord.id,
            username: userRecord.username || trimmedName,
            friendCode: safeCode,
            trainerTitle: userRecord.trainer_title || 'Athlète Vitax',
            avatarPokemonId: userRecord.avatar_pokemon_id || 'athlete',
            avatarPokemonEmoji: userRecord.avatar_pokemon_emoji || '⚡',
            avatarUrl: userRecord.avatar_url || useSettingsStore.getState().avatar_url,
            currentLeague: userRecord.current_league || 'pierre',
            totalXp: userRecord.total_xp || 0,
            totalWorkouts: userRecord.total_workouts || 0,
            createdAt: userRecord.created_at || new Date().toISOString(),
          };

          if (userRecord.avatar_url) {
            await useSettingsStore.getState().setAvatarUrl(userRecord.avatar_url);
          }

          // Si un autre compte était connecté sur cet appareil, purger ses données locales avant de rapatrier le compte actuel
          try {
            const rawPrevProf = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
            const prevProf = rawPrevProf ? JSON.parse(rawPrevProf) : null;
            if (prevProf?.id && prevProf.id !== loadedProfile.id) {
              const { clearUserLocalData } = await import('../database/db');
              await clearUserLocalData();
              await AsyncStorage.multiRemove([
                '@vitax_deleted_ids',
                '@vitax_active_workout_draft',
                '@vitax_favorite_exercise_ids',
                '@vitax_daily_bonus_state',
              ]);
            }
          } catch {}

          const session: AuthSession = {
            userId: loadedProfile.id,
            username: loadedProfile.username,
            friendCode: safeCode,
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

          // Rapatrier immédiatement toutes les données cloud (séances, séries, poids, objectifs, favoris, courses, réglages)
          try {
            const { fullCloudSyncToLocal } = await import('./cloudSyncService');
            await fullCloudSyncToLocal();
          } catch (syncErr) {
            console.warn('Erreur sync après login:', syncErr);
          }

          // Recalculer les stats et synchroniser l'expérience
          try {
            const { getUserGamificationStats } = await import('./gamificationService');
            const gStats = await getUserGamificationStats();
            if (gStats && gStats.totalXp > loadedProfile.totalXp) {
              loadedProfile.totalXp = gStats.totalXp;
            }
            if (gStats && gStats.totalSessions > loadedProfile.totalWorkouts) {
              loadedProfile.totalWorkouts = gStats.totalSessions;
            }
            await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(loadedProfile));
          } catch (calcErr) {
            console.warn('Erreur recalcul stats après login:', calcErr);
          }

          return { success: true, profile: loadedProfile };
        } else if (!error && (!rows || rows.length === 0)) {
          return {
            success: false,
            error: 'Compte introuvable. Veuillez vérifier le nom d’utilisateur ou appuyer sur "Créer un compte".',
          };
        }
      } catch (err: any) {
        console.warn('Erreur connexion Supabase profiles:', err?.message);
      }
    }
  }

  // 2. Vérification locale hors-ligne
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
            trainerTitle: 'Athlète Vitax',
            avatarPokemonId: 'athlete',
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
    error: 'Nom d’utilisateur ou mot de passe incorrect. Si vous n’avez pas encore créé de compte, appuyez sur "Créer un compte".',
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

    // 1. Tenter de rafraîchir en direct le profil depuis la base centrale Supabase
    if (session.userId && isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: row } = await supabase
            .from('profiles')
            .select(
              'id, username, friend_code, trainer_title, avatar_pokemon_id, avatar_pokemon_emoji, current_league, total_xp, total_workouts, avatar_url, created_at'
            )
            .eq('id', session.userId)
            .maybeSingle();

          if (row) {
            const safeCode =
              row.friend_code ||
              (session.friendCode && session.friendCode !== '10000'
                ? session.friendCode
                : generateFriendCode());

            const remoteProf: TrainerProfile = {
              id: row.id,
              username: row.username || session.username,
              friendCode: safeCode,
              trainerTitle: row.trainer_title || 'Athlète Vitax',
              avatarPokemonId: row.avatar_pokemon_id || 'athlete',
              avatarPokemonEmoji: row.avatar_pokemon_emoji || '⚡',
              currentLeague: row.current_league || 'pierre',
              totalXp: row.total_xp || 0,
              totalWorkouts: row.total_workouts || 0,
              createdAt: row.created_at || session.createdAt,
            };

            if (session.friendCode !== safeCode) {
              session.friendCode = safeCode;
              await savePersistedSession(session);
            }

            await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(remoteProf));
            if (remoteProf.username) {
              const currentName = useSettingsStore.getState().user_name;
              if (!currentName || currentName !== remoteProf.username) {
                await useSettingsStore.getState().setUserName(remoteProf.username);
              }
            }
            return remoteProf;
          }
        } catch (fetchErr) {
          console.warn('Erreur rafraîchissement profil Supabase au démarrage:', fetchErr);
        }
      }
    }

    // 2. Repli sur le profil stocké en local
    const rawProf = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    if (rawProf) {
      const prof: TrainerProfile = JSON.parse(rawProf);
      if (!prof.friendCode || prof.friendCode === '10000' || !/^\d{5}$/.test(prof.friendCode)) {
        prof.friendCode =
          session.friendCode && session.friendCode !== '10000'
            ? session.friendCode
            : generateFriendCode();
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(prof));
      }
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
 * Déconnexion du compte athlète
 */
export async function logoutTrainer(): Promise<void> {
  try {
    // 1. Sauvegarder toutes les données locales en temps réel vers Supabase avant la déconnexion
    try {
      const { flushAllRealtimeToSupabase } = await import('./cloudSyncService');
      await flushAllRealtimeToSupabase();
    } catch {}

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
    }

    // 2. Nettoyer les données utilisateur locales pour garantir l'isolation entre comptes
    try {
      const { clearUserLocalData } = await import('../database/db');
      await clearUserLocalData();
    } catch {}

    await AsyncStorage.multiRemove([
      STORAGE_KEY_AUTH_SESSION,
      STORAGE_KEY_PROFILE,
      '@vitax_deleted_ids',
      '@vitax_active_workout_draft',
      '@vitax_favorite_exercise_ids',
      '@vitax_daily_bonus_state',
    ]);
  } catch (e) {
    console.error('Erreur logout:', e);
  }
}

/**
 * Vérifie si un nom d'utilisateur est déjà utilisé par un autre athlète dans Supabase
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', trimmed)
          .limit(1);

        if (!error && data && data.length > 0) {
          const session = await getPersistedSession();
          if (session?.userId && data[0].id === session.userId) {
            return false;
          }
          return true;
        }
      } catch (err) {
        console.warn('Erreur vérification isUsernameTaken:', err);
      }
    }
  }
  return false;
}
