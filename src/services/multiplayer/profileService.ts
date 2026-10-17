import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeagueTier, LeagueConfig, TrainerProfile } from '../../types/social';
import { getUserGamificationStats } from '../gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { useSettingsStore } from '../../stores/settingsStore';
import { getPersistedSession, savePersistedSession, generateFriendCode, STORAGE_KEY_AUTH_SESSION } from '../authService';
import { processImageToHdSquare } from '../../utils/imageUtils';

export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';

// -------------------------------------------------------------
// CONFIGURATION DES 5 LIGUES D'ATHLÈTES
// -------------------------------------------------------------
export const LEAGUE_CONFIGS: Record<LeagueTier, LeagueConfig> = {
  pierre: {
    tier: 'pierre',
    name: 'Ligue Bronze (Novice)',
    emoji: '🥉',
    color: '#78716C',
    minXpRequirement: 0,
    promotionSpots: 5,
    relegationSpots: 0,
  },
  cascade: {
    tier: 'cascade',
    name: 'Ligue Argent (Régulier)',
    emoji: '🥈',
    color: '#38BDF8',
    minXpRequirement: 500,
    promotionSpots: 5,
    relegationSpots: 5,
  },
  foudre: {
    tier: 'foudre',
    name: 'Ligue Or (Confirmé)',
    emoji: '🥇',
    color: '#FACC15',
    minXpRequirement: 1500,
    promotionSpots: 4,
    relegationSpots: 5,
  },
  volcan: {
    tier: 'volcan',
    name: 'Ligue Platine (Élite)',
    emoji: '🔥',
    color: '#F97316',
    minXpRequirement: 3500,
    promotionSpots: 3,
    relegationSpots: 4,
  },
  maitre: {
    tier: 'maitre',
    name: 'Ligue Diamant (Légende)',
    emoji: '👑',
    color: '#A855F7',
    minXpRequirement: 7000,
    promotionSpots: 0,
    relegationSpots: 5,
  },
};

/**
 * Calcule les dates de début (lundi 00:00) et fin (dimanche 23:59) de la semaine courante
 */
export function getCurrentWeekBounds(): { start: Date; end: Date; weekNumber: number; weekId: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const firstJan = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + firstJan.getDay() + 1) / 7);
  const weekId = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

  return { start: monday, end: sunday, weekNumber, weekId };
}

// -------------------------------------------------------------
// PROFIL DRESSEUR & SYNCHRONISATION
// -------------------------------------------------------------

export const PUBLIC_PROFILE_COLUMNS =
  'id, username, friend_code, trainer_title, avatar_pokemon_id, avatar_pokemon_emoji, current_league, total_xp, total_workouts, avatar_url, created_at, updated_at';

export function isAnonymousProfileId(id?: string | null): boolean {
  if (!id) return true;
  if (id === 'default_trainer' || id.startsWith('trainer_')) return true;
  // Les profils locaux non inscrits ont la forme vtx_<timestamp>_<code5chiffres>
  // tandis que les comptes inscrits ont la forme vtx_<username>
  if (/^vtx_\d{10,}_\d+$/.test(id)) return true;
  return false;
}

let inFlightSyncPromise: Promise<boolean> | null = null;
let pendingSyncProfile: TrainerProfile | null = null;

/**
 * Exécute la synchronisation réelle du profil vers Supabase avec protection anti-timeout et compression
 */
async function executeSyncTrainerProfile(profile: TrainerProfile): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const session = await getPersistedSession();
  // Ne synchroniser que les profils de comptes réels (pas les invités anonymes non connectés)
  if (!profile.id || (isAnonymousProfileId(profile.id) && !session?.isLoggedIn)) {
    return false;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    let friendCode = profile.friendCode;
    if (!friendCode || friendCode === '10000' || !/^\d{5}$/.test(friendCode)) {
      if (session?.friendCode && session.friendCode !== '10000' && /^\d{5}$/.test(session.friendCode)) {
        friendCode = session.friendCode;
        profile.friendCode = friendCode;
      }
    }

    const timeoutPromise = <T>(ms: number, message: string): Promise<T> =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message } } as any), ms)
      );

    // Récupérer le profil Supabase existant avec un timeout de 4s max pour ne jamais bloquer
    const { data: cloudRow } = await Promise.race([
      supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq('id', profile.id)
        .maybeSingle(),
      timeoutPromise<any>(4000, 'Timeout récupération profil cloud'),
    ]);

    if (cloudRow) {
      if (!friendCode || friendCode === '10000' || !/^\d{5}$/.test(friendCode)) {
        if (cloudRow.friend_code) {
          friendCode = cloudRow.friend_code;
          profile.friendCode = friendCode;
        }
      }
      // Anti-régression absolue : toujours retenir le maximum d'XP et de séances entre Cloud et Local
      profile.totalXp = Math.max(cloudRow.total_xp || 0, profile.totalXp || 0);
      profile.totalWorkouts = Math.max(cloudRow.total_workouts || 0, profile.totalWorkouts || 0);
      if (!profile.username && cloudRow.username) profile.username = cloudRow.username;
      if (!profile.trainerTitle && cloudRow.trainer_title) profile.trainerTitle = cloudRow.trainer_title;
      if (!profile.avatarPokemonId && cloudRow.avatar_pokemon_id) profile.avatarPokemonId = cloudRow.avatar_pokemon_id;
      if (!profile.avatarPokemonEmoji && cloudRow.avatar_pokemon_emoji) profile.avatarPokemonEmoji = cloudRow.avatar_pokemon_emoji;
      if (!profile.avatarUrl && cloudRow.avatar_url) profile.avatarUrl = cloudRow.avatar_url;
    }

    if (!friendCode || friendCode === '10000' || !/^\d{5}$/.test(friendCode)) {
      friendCode = generateFriendCode();
      profile.friendCode = friendCode;
    }

    // Optimisation et protection HD : si l'avatar dépasse 150 Ko (photo brute de caméra),
    // le compresser automatiquement en carré HD 600x600 (< 80 Ko)
    if (profile.avatarUrl && profile.avatarUrl.length > 150000) {
      try {
        const compressedAvatar = await processImageToHdSquare(profile.avatarUrl);
        if (compressedAvatar && compressedAvatar.length < profile.avatarUrl.length) {
          profile.avatarUrl = compressedAvatar;
        }
      } catch {}
    }

    // Mettre à jour l'AsyncStorage local avec les données consolidées
    await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));

    // Si après compression l'avatar dépasse toujours 350 Ko (ex: base64 natif sans canvas),
    // ne pas envoyer le payload géant pour éviter d'exploser le timeout Postgres statement_timeout
    const avatarToSend =
      profile.avatarUrl && profile.avatarUrl.length > 350000 ? null : (profile.avatarUrl || null);

    const profilePayload: any = {
      id: profile.id,
      username: profile.username || 'Athlète Vitax',
      friend_code: friendCode,
      trainer_title: profile.trainerTitle || 'Athlète Vitax',
      avatar_pokemon_id: profile.avatarPokemonId || 'athlete',
      avatar_pokemon_emoji: profile.avatarPokemonEmoji || '⚡',
      current_league: profile.currentLeague || 'pierre',
      total_xp: profile.totalXp || 0,
      total_workouts: profile.totalWorkouts || 0,
      avatar_url: avatarToSend,
      updated_at: new Date().toISOString(),
    };

    let { error } = await Promise.race([
      supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }),
      timeoutPromise<any>(5000, 'Timeout upsert profil cloud'),
    ]);

    if (error && (error.message?.includes('avatar_url') || error.code === '42703')) {
      delete profilePayload.avatar_url;
      const retry = await Promise.race([
        supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }),
        timeoutPromise<any>(5000, 'Timeout retry upsert profil cloud'),
      ]);
      error = retry.error;
    }

    if (error) {
      if (
        error.code !== '23505' &&
        !error.message?.includes('unique constraint') &&
        !error.message?.includes('statement timeout') &&
        !error.message?.includes('Timeout')
      ) {
        console.warn('Erreur Supabase upsert profil:', error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception syncTrainerProfileToSupabase:', err);
    return false;
  }
}

/**
 * Synchronise le profil athlète avec Supabase de façon non-bloquante,
 * avec fusion des appels simultanés (in-flight deduplication) pour éviter les blocages de verrous Postgres.
 */
export async function syncTrainerProfileToSupabase(profile: TrainerProfile): Promise<boolean> {
  if (inFlightSyncPromise) {
    pendingSyncProfile = profile;
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    try {
      return await executeSyncTrainerProfile(profile);
    } finally {
      inFlightSyncPromise = null;
      if (pendingSyncProfile) {
        const nextProfile = pendingSyncProfile;
        pendingSyncProfile = null;
        void syncTrainerProfileToSupabase(nextProfile);
      }
    }
  })();

  return inFlightSyncPromise;
}

/**
 * Met à jour instantanément les statistiques et l'expérience du profil après une séance
 * et les synchronise avec Supabase et le stockage local
 */
export async function updateTrainerProfileXpAndStats(
  xpGained: number,
  _volumeGained: number = 0
): Promise<TrainerProfile> {
  const profile = await getOrCreateTrainerProfile();

  profile.totalXp = Math.max(0, (profile.totalXp || 0) + Math.round(xpGained));
  profile.totalWorkouts = Math.max(1, (profile.totalWorkouts || 0) + 1);

  // Mise à jour de la ligue si l'XP dépasse le palier
  if (profile.totalXp >= 7000) {
    profile.currentLeague = 'maitre';
  } else if (profile.totalXp >= 3500) {
    profile.currentLeague = 'volcan';
  } else if (profile.totalXp >= 1500) {
    profile.currentLeague = 'foudre';
  } else if (profile.totalXp >= 500) {
    profile.currentLeague = 'cascade';
  }

  // Sauvegarde locale dans AsyncStorage
  await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));

  // Mise à jour de la session auth si connecté
  try {
    const rawSession = await AsyncStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      parsed.totalXp = profile.totalXp;
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(parsed));
    }
  } catch (sessErr) {
    console.warn('Erreur mise à jour auth session XP:', sessErr);
  }

  // Synchronisation avec Supabase
  void syncTrainerProfileToSupabase(profile);

  return profile;
}

export async function getOrCreateTrainerProfile(): Promise<TrainerProfile> {
  try {
    const session = await getPersistedSession();
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    const storeName = useSettingsStore.getState().user_name;

    // Récupérer les stats de gamification
    let gamification = {
      totalXp: 0,
      totalSessions: 0,
      levelInfo: { title: 'Athlète Vitax' },
    };
    try {
      const stats = await getUserGamificationStats();
      if (stats) {
        gamification = {
          totalXp: stats.totalXp || 0,
          totalSessions: stats.totalSessions || 0,
          levelInfo: stats.levelInfo || { title: 'Athlète Vitax' },
        };
      }
    } catch (gamErr) {
      console.warn('Stats gamification non dispo dans getOrCreateTrainerProfile:', gamErr);
    }

    let profileToReturn: TrainerProfile;

    if (raw) {
      const parsed: TrainerProfile = JSON.parse(raw);
      if (useSettingsStore.getState().avatar_url) {
        parsed.avatarUrl = useSettingsStore.getState().avatar_url;
      } else if (parsed.avatarUrl) {
        void useSettingsStore.getState().setAvatarUrl(parsed.avatarUrl);
      }

      // Si l'utilisateur a un compte actif, l'identifiant d'arène DOIT être strictement identique à l'identifiant de compte
      if (session?.isLoggedIn && session.userId) {
        parsed.id = session.userId;
        if (session.username) parsed.username = session.username;
        if (session.friendCode && session.friendCode !== '10000') {
          parsed.friendCode = session.friendCode;
        }

        // Récupérer en direct le profil authentique et à jour depuis Supabase
        if (isSupabaseConfigured()) {
          const supabase = getSupabaseClient();
          if (supabase) {
            try {
              const { data: cloudRow } = await supabase
                .from('profiles')
                .select(PUBLIC_PROFILE_COLUMNS)
                .eq('id', session.userId)
                .maybeSingle();

              if (cloudRow) {
                if (cloudRow.friend_code) {
                  parsed.friendCode = cloudRow.friend_code;
                  if (session.friendCode !== cloudRow.friend_code) {
                    session.friendCode = cloudRow.friend_code;
                    await savePersistedSession(session);
                  }
                }
                if (cloudRow.username) parsed.username = cloudRow.username;
                if (cloudRow.trainer_title) parsed.trainerTitle = cloudRow.trainer_title;
                if (cloudRow.avatar_pokemon_id) parsed.avatarPokemonId = cloudRow.avatar_pokemon_id;
                if (cloudRow.avatar_pokemon_emoji) parsed.avatarPokemonEmoji = cloudRow.avatar_pokemon_emoji;
                if (cloudRow.avatar_url) parsed.avatarUrl = cloudRow.avatar_url;
                if (cloudRow.current_league) parsed.currentLeague = cloudRow.current_league as LeagueTier;
                if (cloudRow.total_xp && cloudRow.total_xp > (parsed.totalXp || 0)) {
                  parsed.totalXp = cloudRow.total_xp;
                }
                if (cloudRow.total_workouts && cloudRow.total_workouts > (parsed.totalWorkouts || 0)) {
                  parsed.totalWorkouts = cloudRow.total_workouts;
                }
              }
            } catch (cloudErr) {
              console.warn('Erreur vérification profil cloud Supabase:', cloudErr);
            }
          }
        }
      }

      // Si le code ami est factice ('10000') ou absent ou invalide, tenter de retrouver le compte par le nom dans Supabase
      if (
        (!parsed.friendCode || parsed.friendCode === '10000' || !/^\d{5}$/.test(parsed.friendCode)) &&
        isSupabaseConfigured()
      ) {
        const candidateName = (storeName || parsed.username || '').trim();
        if (candidateName) {
          const supabase = getSupabaseClient();
          if (supabase) {
            try {
              const { data: matched } = await supabase
                .from('profiles')
                .select(PUBLIC_PROFILE_COLUMNS)
                .ilike('username', candidateName)
                .maybeSingle();

              if (matched && matched.friend_code) {
                parsed.friendCode = matched.friend_code;
                parsed.id = matched.id;
                if (matched.username) parsed.username = matched.username;
              }
            } catch {}
          }
        }
      }

      parsed.totalXp = Math.max(parsed.totalXp || 0, gamification.totalXp);
      parsed.totalWorkouts = Math.max(parsed.totalWorkouts || 0, gamification.totalSessions);
      if (storeName && storeName.trim()) {
        parsed.username = storeName.trim();
      }

      // Élimination absolue du code factice 10000 ou format invalide
      if (!parsed.friendCode || parsed.friendCode === '10000' || !/^\d{5}$/.test(parsed.friendCode)) {
        parsed.friendCode = generateFriendCode();
      }

      const activeLeagueXp = parsed.totalXp;
      if (activeLeagueXp >= 7000) parsed.currentLeague = 'maitre';
      else if (activeLeagueXp >= 3500) parsed.currentLeague = 'volcan';
      else if (activeLeagueXp >= 1500) parsed.currentLeague = 'foudre';
      else if (activeLeagueXp >= 500) parsed.currentLeague = 'cascade';
      else parsed.currentLeague = 'pierre';

      await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(parsed));
      if (session?.isLoggedIn && session.userId && !isAnonymousProfileId(session.userId)) {
        void syncTrainerProfileToSupabase(parsed);
      }
      profileToReturn = parsed;
    } else {
      let fetchedFromCloud: TrainerProfile | null = null;
      if (session?.isLoggedIn && session.userId && isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data: cloudRow } = await supabase
              .from('profiles')
              .select(PUBLIC_PROFILE_COLUMNS)
              .eq('id', session.userId)
              .maybeSingle();

            if (cloudRow) {
              const realCode =
                cloudRow.friend_code ||
                (session.friendCode && session.friendCode !== '10000'
                  ? session.friendCode
                  : generateFriendCode());

              fetchedFromCloud = {
                id: cloudRow.id,
                username: cloudRow.username || session.username || 'Athlète Vitax',
                friendCode: realCode,
                trainerTitle: cloudRow.trainer_title || gamification.levelInfo.title,
                avatarPokemonId: cloudRow.avatar_pokemon_id || 'athlete',
                avatarPokemonEmoji: cloudRow.avatar_pokemon_emoji || '⚡',
                avatarUrl: cloudRow.avatar_url || useSettingsStore.getState().avatar_url,
                currentLeague: (cloudRow.current_league as LeagueTier) || 'pierre',
                totalXp: Math.max(cloudRow.total_xp || 0, gamification.totalXp),
                totalWorkouts: Math.max(cloudRow.total_workouts || 0, gamification.totalSessions),
                createdAt: cloudRow.created_at || session.createdAt || new Date().toISOString(),
              };

              if (session.friendCode !== realCode) {
                session.friendCode = realCode;
                await savePersistedSession(session);
              }
            }
          } catch {}
        }
      }

      // Si pas encore connecté mais un nom d'athlète est renseigné dans les réglages, chercher dans Supabase
      if (!fetchedFromCloud && storeName && isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data: matched } = await supabase
              .from('profiles')
              .select(PUBLIC_PROFILE_COLUMNS)
              .ilike('username', storeName.trim())
              .maybeSingle();

            if (matched && matched.friend_code) {
              fetchedFromCloud = {
                id: matched.id,
                username: matched.username,
                friendCode: matched.friend_code,
                trainerTitle: matched.trainer_title || gamification.levelInfo.title,
                avatarPokemonId: matched.avatar_pokemon_id || 'athlete',
                avatarPokemonEmoji: matched.avatar_pokemon_emoji || '⚡',
                avatarUrl: matched.avatar_url || useSettingsStore.getState().avatar_url,
                currentLeague: (matched.current_league as LeagueTier) || 'pierre',
                totalXp: Math.max(matched.total_xp || 0, gamification.totalXp),
                totalWorkouts: Math.max(matched.total_workouts || 0, gamification.totalSessions),
                createdAt: matched.created_at || new Date().toISOString(),
              };
            }
          } catch {}
        }
      }

      if (fetchedFromCloud) {
        profileToReturn = fetchedFromCloud;
      } else {
        const friendCode =
          session?.friendCode && session.friendCode !== '10000'
            ? session.friendCode
            : generateFriendCode();
        const effectiveName = session?.username || storeName || gamification.levelInfo.title || 'Athlète Vitax';
        const effectiveId = session?.isLoggedIn && session.userId ? session.userId : `vtx_${Date.now()}_${friendCode}`;

        profileToReturn = {
          id: effectiveId,
          username: effectiveName,
          friendCode,
          trainerTitle: gamification.levelInfo.title,
          avatarPokemonId: 'athlete',
          avatarPokemonEmoji: '⚡',
          avatarUrl: useSettingsStore.getState().avatar_url,
          currentLeague: 'pierre',
          totalXp: gamification.totalXp,
          totalWorkouts: gamification.totalSessions,
          createdAt: session?.createdAt || new Date().toISOString(),
        };
      }

      await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profileToReturn));
    }

    void syncTrainerProfileToSupabase(profileToReturn);
    return profileToReturn;
  } catch (err) {
    console.error('Erreur getOrCreateTrainerProfile:', err);
    const storeName = useSettingsStore.getState().user_name;
    return {
      id: 'default_trainer',
      username: storeName || 'Athlète Vitax',
      friendCode: generateFriendCode(),
      trainerTitle: 'Athlète Novice',
      avatarPokemonId: 'athlete',
      avatarPokemonEmoji: '⚡',
      currentLeague: 'pierre',
      totalXp: 0,
      totalWorkouts: 0,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function updateTrainerProfile(updates: Partial<TrainerProfile>): Promise<TrainerProfile> {
  const current = await getOrCreateTrainerProfile();
  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
  void syncTrainerProfileToSupabase(updated);
  return updated;
}
