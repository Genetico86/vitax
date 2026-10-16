import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeagueTier, LeagueConfig, TrainerProfile } from '../../types/social';
import { getUserGamificationStats } from '../gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { useSettingsStore } from '../../stores/settingsStore';
import { getPersistedSession, savePersistedSession, generateFriendCode, STORAGE_KEY_AUTH_SESSION } from '../authService';

export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';

// -------------------------------------------------------------
// CONFIGURATION DES 5 LIGUES D'ARÈNES POKÉMON
// -------------------------------------------------------------
export const LEAGUE_CONFIGS: Record<LeagueTier, LeagueConfig> = {
  pierre: {
    tier: 'pierre',
    name: 'Ligue Pierre (Argenta)',
    emoji: '🪨',
    color: '#78716C',
    minXpRequirement: 0,
    promotionSpots: 5,
    relegationSpots: 0,
  },
  cascade: {
    tier: 'cascade',
    name: 'Ligue Cascade (Azuria)',
    emoji: '💧',
    color: '#38BDF8',
    minXpRequirement: 500,
    promotionSpots: 5,
    relegationSpots: 5,
  },
  foudre: {
    tier: 'foudre',
    name: 'Ligue Foudre (Carmin)',
    emoji: '⚡',
    color: '#FACC15',
    minXpRequirement: 1500,
    promotionSpots: 4,
    relegationSpots: 5,
  },
  volcan: {
    tier: 'volcan',
    name: 'Ligue Volcan (Cramois’Île)',
    emoji: '🌋',
    color: '#F97316',
    minXpRequirement: 3500,
    promotionSpots: 3,
    relegationSpots: 4,
  },
  maitre: {
    tier: 'maitre',
    name: 'Ligue Maître (Conseil 4)',
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

export async function syncTrainerProfileToSupabase(profile: TrainerProfile): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  // Ne synchroniser que les profils de comptes réels (pas les invités anonymes trainer_... ou vtx_... ou default_trainer)
  if (
    !profile.id ||
    profile.id.startsWith('trainer_') ||
    profile.id.startsWith('vtx_') ||
    profile.id === 'default_trainer'
  ) {
    return false;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    let friendCode = profile.friendCode;
    if (!friendCode || friendCode === '10000' || !/^\d{5}$/.test(friendCode)) {
      if (session?.friendCode && session.friendCode !== '10000' && /^\d{5}$/.test(session.friendCode)) {
        friendCode = session.friendCode;
        profile.friendCode = friendCode;
      }
    }

    // Récupérer le profil Supabase existant pour garantir l'absence absolue de régression
    const { data: cloudRow } = await supabase
      .from('profiles')
      .select('friend_code, total_xp, total_workouts, username, trainer_title, avatar_pokemon_id, avatar_pokemon_emoji, current_league')
      .eq('id', profile.id)
      .maybeSingle();

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
    }

    if (!friendCode || friendCode === '10000' || !/^\d{5}$/.test(friendCode)) {
      friendCode = generateFriendCode();
      profile.friendCode = friendCode;
    }

    // Mettre à jour l'AsyncStorage local avec les données consolidées
    await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));

    const { error } = await supabase.from('profiles').upsert(
      {
        id: profile.id,
        username: profile.username || 'Athlète Vitax',
        friend_code: friendCode,
        trainer_title: profile.trainerTitle || 'Athlète Vitax',
        avatar_pokemon_id: profile.avatarPokemonId || 'pikachu',
        avatar_pokemon_emoji: profile.avatarPokemonEmoji || '⚡',
        current_league: profile.currentLeague || 'pierre',
        total_xp: profile.totalXp || 0,
        total_workouts: profile.totalWorkouts || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) {
      if (error.code !== '23505' && !error.message?.includes('unique constraint')) {
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
      hatchedPokemon: [] as any[],
    };
    try {
      const stats = await getUserGamificationStats();
      if (stats) {
        gamification = {
          totalXp: stats.totalXp || 0,
          totalSessions: stats.totalSessions || 0,
          levelInfo: stats.levelInfo || { title: 'Athlète Vitax' },
          hatchedPokemon: stats.hatchedPokemon || [],
        };
      }
    } catch (gamErr) {
      console.warn('Stats gamification non dispo dans getOrCreateTrainerProfile:', gamErr);
    }

    let profileToReturn: TrainerProfile;

    if (raw) {
      const parsed: TrainerProfile = JSON.parse(raw);

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
                .select('*')
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
                if (cloudRow.current_league) parsed.currentLeague = cloudRow.current_league;
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
                .select('*')
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
      if (session?.isLoggedIn && session.userId && !session.userId.startsWith('trainer_')) {
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
              .select('*')
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
                avatarPokemonId: cloudRow.avatar_pokemon_id || 'pikachu',
                avatarPokemonEmoji: cloudRow.avatar_pokemon_emoji || '⚡',
                currentLeague: cloudRow.current_league || 'pierre',
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
              .select('*')
              .ilike('username', storeName.trim())
              .maybeSingle();

            if (matched && matched.friend_code) {
              fetchedFromCloud = {
                id: matched.id,
                username: matched.username,
                friendCode: matched.friend_code,
                trainerTitle: matched.trainer_title || gamification.levelInfo.title,
                avatarPokemonId: matched.avatar_pokemon_id || 'pikachu',
                avatarPokemonEmoji: matched.avatar_pokemon_emoji || '⚡',
                currentLeague: matched.current_league || 'pierre',
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
        const defaultAvatar = gamification.hatchedPokemon[0]?.pokemon_id || 'pikachu';
        const defaultEmoji = gamification.hatchedPokemon[0]?.pokemon_emoji || '⚡';
        const effectiveName = session?.username || storeName || gamification.levelInfo.title || 'Athlète Vitax';
        const effectiveId = session?.isLoggedIn && session.userId ? session.userId : `vtx_${Date.now()}_${friendCode}`;

        profileToReturn = {
          id: effectiveId,
          username: effectiveName,
          friendCode,
          trainerTitle: gamification.levelInfo.title,
          avatarPokemonId: defaultAvatar,
          avatarPokemonEmoji: defaultEmoji,
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
      trainerTitle: 'Athlète Débutant',
      avatarPokemonId: 'pikachu',
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
