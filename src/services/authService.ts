import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured, setSupabaseActiveUserId } from './supabaseClient';
import { TrainerProfile, AuthSession } from '../types/social';
import { useSettingsStore } from '../stores/settingsStore';
import {
  hashPasswordPBKDF2,
  verifyPasswordSecure,
  isHashedPassword,
} from '../utils/cryptoSecurity';

export const STORAGE_KEY_AUTH_SESSION = '@vitax_auth_session';
export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';
export const STORAGE_KEY_CREDENTIALS = '@vitax_local_creds';

const AUTH_SELECT_COLUMNS =
  'id, username, password, password_hash, friend_code, trainer_title, avatar_pokemon_id, avatar_pokemon_emoji, current_league, total_xp, total_workouts, avatar_url, created_at';

const AUTH_SELECT_COLUMNS_FALLBACK =
  'id, username, password, friend_code, trainer_title, avatar_pokemon_id, avatar_pokemon_emoji, current_league, total_xp, total_workouts, avatar_url, created_at';

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
    const parsed: AuthSession = JSON.parse(raw);
    if (parsed?.userId) {
      setSupabaseActiveUserId(parsed.userId);
    }
    return parsed;
  } catch (e) {
    console.error('Erreur lecture session persistée:', e);
    return null;
  }
}

type AuthChangeListener = (session: AuthSession | null) => void;
const authChangeListeners = new Set<AuthChangeListener>();

/**
 * Permet aux stores et composants d'écouter en temps réel tout changement d'état d'authentification
 */
export function onAuthStateChanged(listener: AuthChangeListener): () => void {
  authChangeListeners.add(listener);
  return () => {
    authChangeListeners.delete(listener);
  };
}

export function notifyAuthStateChanged(session: AuthSession | null): void {
  authChangeListeners.forEach((listener) => {
    try {
      listener(session);
    } catch (e) {
      console.warn('Erreur listener onAuthStateChanged:', e);
    }
  });
}

/**
 * Sauvegarde la session persistée
 */
export async function savePersistedSession(session: AuthSession): Promise<void> {
  if (session?.userId) {
    setSupabaseActiveUserId(session.userId);
  }
  await AsyncStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(session));
  notifyAuthStateChanged(session);
}

/**
 * Synchronise de manière transparente une session Supabase Auth (JWT) à partir du hash PBKDF2
 * afin d'alimenter auth.uid() lorsque Supabase Auth est activé sur le projet.
 */
async function syncSupabaseNativeAuth(
  cleanUser: string,
  userId: string,
  username: string,
  passwordHash: string,
  isRegistration: boolean
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const syntheticEmail = `${cleanUser}@auth.vitax.app`;
  const derivedAuthSecret = `Vtx!${passwordHash.slice(-28)}`;

  try {
    if (isRegistration) {
      await supabase.auth.signUp({
        email: syntheticEmail,
        password: derivedAuthSecret,
        options: {
          data: {
            vitax_user_id: userId,
            username,
          },
        },
      });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: derivedAuthSecret,
      });
      if (error && error.message?.toLowerCase().includes('invalid login credentials')) {
        await supabase.auth.signUp({
          email: syntheticEmail,
          password: derivedAuthSecret,
          options: {
            data: {
              vitax_user_id: userId,
              username,
            },
          },
        });
      }
    }
  } catch {
    // Non-bloquant si Supabase Auth email/password est désactivé ou soumis à confirmation email
  }
}

/**
 * Migre silencieusement d'éventuels anciens identifiants locaux stockés en clair vers PBKDF2
 */
async function migrateLegacyLocalCredentialsIfNeeded(): Promise<void> {
  try {
    const rawCreds = await AsyncStorage.getItem(STORAGE_KEY_CREDENTIALS);
    if (!rawCreds) return;
    const creds = JSON.parse(rawCreds);
    if (creds && creds.username && creds.password && !creds.passwordHash) {
      const passwordHash = await hashPasswordPBKDF2(creds.password, creds.username);
      await AsyncStorage.setItem(
        STORAGE_KEY_CREDENTIALS,
        JSON.stringify({ username: creds.username, passwordHash })
      );
    }
  } catch {}
}

/**
 * Inscription d'un Athlète avec Nom d'utilisateur + Mot de passe
 * Le mot de passe est systématiquement haché en PBKDF2-HMAC-SHA256 avant tout stockage ou envoi réseau.
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
  const passwordHash = await hashPasswordPBKDF2(password, trimmedName);

  setSupabaseActiveUserId(userId);

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

  // 1. Enregistrement central sécurisé dans Supabase (condensat PBKDF2 uniquement, jamais de mot de passe en clair)
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

        // Tenter d'abord l'inscription via la fonction RPC sécurisée côté serveur (SECURITY DEFINER)
        const { error: rpcErr } = await supabase.rpc('register_trainer_secure', {
          p_id: userId,
          p_username: trimmedName,
          p_password_hash: passwordHash,
          p_friend_code: friendCode,
          p_trainer_title: initialProfile.trainerTitle,
          p_avatar_url: initialProfile.avatarUrl || null,
        });

        // Si la fonction RPC n'est pas encore déployée sur la base Supabase, repli sécurisé avec hash PBKDF2
        if (rpcErr) {
          const isRpcMissing =
            rpcErr.code === '42883' ||
            rpcErr.code === 'PGRST202' ||
            rpcErr.message?.includes('register_trainer_secure');

          if (!isRpcMissing) {
            if (
              rpcErr.code === '23505' ||
              rpcErr.message?.includes('unique') ||
              rpcErr.message?.includes('duplicate') ||
              rpcErr.message?.includes('USERNAME_TAKEN')
            ) {
              return {
                success: false,
                error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
              };
            }
          }

          const insertPayload: Record<string, any> = {
            id: userId,
            username: trimmedName,
            password: passwordHash,
            password_hash: passwordHash,
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

          // Si la colonne password_hash ou avatar_url n'existe pas encore sur le schéma distant
          if (
            insertErr &&
            (insertErr.message?.includes('password_hash') ||
              insertErr.message?.includes('avatar_url') ||
              insertErr.code === '42703')
          ) {
            delete insertPayload.password_hash;
            if (insertErr.message?.includes('avatar_url')) {
              delete insertPayload.avatar_url;
            }
            const retry = await supabase.from('profiles').insert(insertPayload);
            insertErr = retry.error;
          }

          if (insertErr) {
            if (
              insertErr.code === '23505' ||
              insertErr.message?.includes('unique') ||
              insertErr.message?.includes('duplicate')
            ) {
              return {
                success: false,
                error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
              };
            }

            if (insertErr.code === '42501') {
              return {
                success: false,
                error:
                  'Accès base de données refusé par la politique RLS. Veuillez mettre à jour le script SQL dans Supabase.',
              };
            }

            console.warn('Erreur insertion profil Supabase:', insertErr.message);
            if (insertErr.message?.includes('password')) {
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

              if (fallbackErr && (fallbackErr.code === '23505' || fallbackErr.message?.includes('unique'))) {
                return {
                  success: false,
                  error: 'Ce nom d’utilisateur existe déjà. Veuillez vous connecter ou choisir un autre nom.',
                };
              }
              if (fallbackErr) {
                return {
                  success: false,
                  error: `Impossible d'enregistrer le profil dans Supabase : ${fallbackErr.message}`,
                };
              }
            } else {
              return {
                success: false,
                error: `Impossible d'enregistrer le compte dans la base de données : ${insertErr.message}`,
              };
            }
          }
        }

        void syncSupabaseNativeAuth(cleanUser, userId, trimmedName, passwordHash, true);
      } catch (err: any) {
        console.warn('Exception inscription Supabase:', err?.message);
        return {
          success: false,
          error: `Erreur de connexion à la base de données : ${err?.message || 'Inconnue'}`,
        };
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

  // 2. Persistance locale sécurisée (aucun mot de passe en clair stocké)
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
    JSON.stringify({ username: trimmedName, passwordHash })
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
 * Vérifie le condensat cryptographique PBKDF2 et migre automatiquement tout ancien mot de passe en clair.
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
  const candidatePasswordHash = await hashPasswordPBKDF2(password, trimmedName);

  // 1. Vérification dans la base centrale Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let userRecord: any = null;
        let authenticatedViaRpc = false;

        // 1a. Tenter d'abord la vérification serveur RPC SECURITY DEFINER (sans exposer les colonnes de hash)
        const { data: rpcRows, error: rpcErr } = await supabase.rpc('authenticate_trainer_secure', {
          p_username: trimmedName,
          p_password_hash: candidatePasswordHash,
          p_legacy_plaintext: password,
        });

        if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
          userRecord = rpcRows[0];
          authenticatedViaRpc = true;
        } else if (rpcErr && rpcErr.message?.includes('INVALID_CREDENTIALS')) {
          return { success: false, error: 'Mot de passe incorrect.' };
        } else if (rpcErr && rpcErr.message?.includes('PASSWORD_RESET_REQUIRED')) {
          return {
            success: false,
            error: 'Ce compte nécessite une mise à jour de sécurité depuis son appareil d’origine.',
          };
        }

        // 1b. Repli si la fonction RPC n'est pas encore installée sur Supabase
        if (!authenticatedViaRpc) {
          let { data: rows, error } = await supabase
            .from('profiles')
            .select(AUTH_SELECT_COLUMNS)
            .ilike('username', trimmedName);

          if (error && (error.message?.includes('password_hash') || error.code === '42703')) {
            const retry = await supabase
              .from('profiles')
              .select(AUTH_SELECT_COLUMNS_FALLBACK)
              .ilike('username', trimmedName);
            rows = retry.data as any;
            error = retry.error;
          }

          if (error) {
            console.warn('Erreur connexion Supabase profiles:', error.message);
            if (error.code === '42501') {
              return {
                success: false,
                error:
                  'Accès base de données refusé par la politique RLS. Veuillez exécuter le script SQL mis à jour dans Supabase.',
              };
            }
            return {
              success: false,
              error: `Erreur de connexion à la base de données : ${error.message}`,
            };
          }

          if (rows && rows.length > 0) {
            userRecord = rows[0];
            const storedSecret: string | null =
              userRecord.password_hash || userRecord.password || null;

            if (storedSecret) {
              const canonicalUsername = userRecord.username || trimmedName;
              const { valid, needsMigration } = await verifyPasswordSecure(
                password,
                canonicalUsername,
                storedSecret
              );

              if (!valid) {
                return { success: false, error: 'Mot de passe incorrect.' };
              }

              // Migration transparente et immédiate d'un ancien mot de passe en clair vers PBKDF2-SHA256
              if (needsMigration || !isHashedPassword(userRecord.password)) {
                try {
                  setSupabaseActiveUserId(userRecord.id);
                  const migratedHash = await hashPasswordPBKDF2(password, canonicalUsername);
                  const updatePayload: Record<string, any> = {
                    password: migratedHash,
                    password_hash: migratedHash,
                    updated_at: new Date().toISOString(),
                  };
                  const { error: migErr } = await supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('id', userRecord.id);
                  if (migErr && (migErr.message?.includes('password_hash') || migErr.code === '42703')) {
                    await supabase
                      .from('profiles')
                      .update({ password: migratedHash, updated_at: new Date().toISOString() })
                      .eq('id', userRecord.id);
                  }
                } catch {}
              }
            } else {
              // Protection contre l'Account Takeover :
              // Si aucun mot de passe n'était défini sur le profil, seul l'appareil possédant DÉJÀ
              // une session authentifiée active pour cet identifiant peut initialiser son condensat.
              const existingSession = await getPersistedSession();
              const isLegitimateDeviceOwner = Boolean(
                existingSession?.isLoggedIn && existingSession.userId === userRecord.id
              );

              if (!isLegitimateDeviceOwner) {
                return {
                  success: false,
                  error:
                    'Ce compte ne possède pas encore d’empreinte de sécurité active. Connectez-vous depuis l’appareil d’origine du compte.',
                };
              }

              try {
                setSupabaseActiveUserId(userRecord.id);
                const canonicalHash = await hashPasswordPBKDF2(
                  password,
                  userRecord.username || trimmedName
                );
                await supabase
                  .from('profiles')
                  .update({ password: canonicalHash })
                  .eq('id', userRecord.id);
              } catch {}
            }
          }
        }

        if (userRecord) {
          setSupabaseActiveUserId(userRecord.id);
          void syncSupabaseNativeAuth(
            cleanUser,
            userRecord.id,
            userRecord.username || trimmedName,
            candidatePasswordHash,
            false
          );

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

          const canonicalHash = await hashPasswordPBKDF2(password, loadedProfile.username);
          await savePersistedSession(session);
          await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(loadedProfile));
          await AsyncStorage.setItem(
            STORAGE_KEY_CREDENTIALS,
            JSON.stringify({ username: loadedProfile.username, passwordHash: canonicalHash })
          );
          await useSettingsStore.getState().setUserName(loadedProfile.username);

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
        } else {
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

  // 2. Vérification locale hors-ligne (via condensat PBKDF2 uniquement)
  try {
    await migrateLegacyLocalCredentialsIfNeeded();
    const rawCreds = await AsyncStorage.getItem(STORAGE_KEY_CREDENTIALS);
    if (rawCreds) {
      const creds = JSON.parse(rawCreds);
      const storedSecret = creds.passwordHash || creds.password;
      if (creds.username && sanitizeUsername(creds.username) === cleanUser && storedSecret) {
        const { valid } = await verifyPasswordSecure(password, creds.username, storedSecret);
        if (valid) {
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
    await migrateLegacyLocalCredentialsIfNeeded();
    const session = await getPersistedSession();
    if (!session || !session.isLoggedIn) {
      return null;
    }

    if (session.userId) {
      setSupabaseActiveUserId(session.userId);
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
              avatarUrl: row.avatar_url || useSettingsStore.getState().avatar_url,
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
 * Déconnexion du compte athlète et purge intégrale des secrets de session locaux
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

    setSupabaseActiveUserId(null);

    // 2. Nettoyer les données utilisateur locales et les identifiants stockés pour garantir l'isolation entre comptes
    try {
      const { clearUserLocalData } = await import('../database/db');
      await clearUserLocalData();
    } catch {}

    await AsyncStorage.multiRemove([
      STORAGE_KEY_AUTH_SESSION,
      STORAGE_KEY_PROFILE,
      STORAGE_KEY_CREDENTIALS,
      '@vitax_deleted_ids',
      '@vitax_active_workout_draft',
      '@vitax_favorite_exercise_ids',
      '@vitax_daily_bonus_state',
    ]);
    notifyAuthStateChanged(null);
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

/**
 * Conformité RGPD (Article 17 - Droit à l'oubli) :
 * Supprime définitivement le compte athlète et l'intégralité de ses données Cloud (Supabase) et locales (SQLite + AsyncStorage).
 */
export async function deleteTrainerAccountAndCloudData(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getPersistedSession();
    const rawProf = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    const prof = rawProf ? JSON.parse(rawProf) : null;
    const userId = session?.userId || prof?.id;

    if (userId && isSupabaseConfigured()) {
      setSupabaseActiveUserId(userId);
      const supabase = getSupabaseClient();
      if (supabase) {
        await Promise.allSettled([
          supabase.from('workout_sets').delete().eq('user_id', userId),
          supabase.from('workout_sessions').delete().eq('user_id', userId),
          supabase.from('user_favorites').delete().eq('user_id', userId),
          supabase.from('body_weights').delete().eq('user_id', userId),
          supabase.from('fitness_goals').delete().eq('user_id', userId),
          supabase.from('running_sessions').delete().eq('user_id', userId),
          supabase.from('weekly_leaderboards').delete().eq('user_id', userId),
          supabase.from('raid_contributions').delete().eq('user_id', userId),
          supabase.from('trades').delete().eq('sender_id', userId),
          supabase.from('friends').delete().eq('user_id', userId),
          supabase.from('friends').delete().eq('friend_id', userId),
          supabase.from('friend_requests').delete().eq('sender_id', userId),
          supabase.from('friend_requests').delete().eq('receiver_id', userId),
          supabase.from('friend_gifts').delete().eq('sender_id', userId),
          supabase.from('friend_gifts').delete().eq('receiver_id', userId),
          supabase.from('friend_challenges').delete().eq('creator_id', userId),
        ]);

        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.signOut().catch(() => {});
      }
    }

    setSupabaseActiveUserId(null);

    const { resetDatabase } = await import('../database/db');
    await resetDatabase();

    await AsyncStorage.multiRemove([
      STORAGE_KEY_AUTH_SESSION,
      STORAGE_KEY_PROFILE,
      STORAGE_KEY_CREDENTIALS,
      '@vitax_deleted_ids',
      '@vitax_active_workout_draft',
      '@vitax_favorite_exercise_ids',
      '@vitax_daily_bonus_state',
      '@vitax_friends_list',
      '@vitax_friend_requests',
      '@vitax_friend_challenges',
      '@vitax_friend_gifts_v1',
    ]);
    notifyAuthStateChanged(null);

    return { success: true };
  } catch (err: any) {
    console.error('Erreur suppression compte RGPD:', err);
    return {
      success: false,
      error: err?.message || 'Erreur lors de la suppression des données.',
    };
  }
}

