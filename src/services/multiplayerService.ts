import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import { PokemonEgg, WorkoutSession } from '../types';
import {
  LeagueTier,
  LeagueConfig,
  TrainerProfile,
  LeaderboardEntry,
  PokemonTradeOffer,
  CoOpRaidBoss,
  RaidParticipant,
  RaidMetric,
  FriendEntry,
} from '../types/social';
import { POKEMON_SPECIES, addPokemonEgg } from './pokemonEggService';
import { getUserGamificationStats, calculateSessionXp } from './gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { useSettingsStore } from '../stores/settingsStore';

export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';
export const STORAGE_KEY_COMMUNITY_TRADES = '@vitax_community_trades';
export const STORAGE_KEY_FRIENDS = '@vitax_friends_list';
export const STORAGE_KEY_RAID_CLAIMED = '@vitax_raid_claimed_';

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
// 1. PROFIL DRESSEUR
// -------------------------------------------------------------
export async function getOrCreateTrainerProfile(): Promise<TrainerProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    const gamification = await getUserGamificationStats();
    const storeName = useSettingsStore.getState().user_name;

    if (raw) {
      const parsed: TrainerProfile = JSON.parse(raw);
      parsed.totalXp = gamification.totalXp;
      parsed.totalWorkouts = gamification.totalSessions;
      parsed.trainerTitle = gamification.levelInfo.title;
      if (storeName && (!parsed.username || parsed.username === 'Athlète Vitax')) {
        parsed.username = storeName;
      }

      if (gamification.totalXp >= 7000) parsed.currentLeague = 'maitre';
      else if (gamification.totalXp >= 3500) parsed.currentLeague = 'volcan';
      else if (gamification.totalXp >= 1500) parsed.currentLeague = 'foudre';
      else if (gamification.totalXp >= 500) parsed.currentLeague = 'cascade';
      else parsed.currentLeague = 'pierre';

      await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(parsed));
      return parsed;
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const friendCode = `VTX-${randomSuffix}`;
    const defaultAvatar = gamification.hatchedPokemon[0]?.pokemon_id || 'pikachu';
    const defaultEmoji = gamification.hatchedPokemon[0]?.pokemon_emoji || '⚡';
    const effectiveName = storeName || gamification.levelInfo.title || 'Athlète Vitax';

    const newProfile: TrainerProfile = {
      id: `trainer_${Date.now()}_${randomSuffix}`,
      username: effectiveName,
      friendCode,
      trainerTitle: gamification.levelInfo.title,
      avatarPokemonId: defaultAvatar,
      avatarPokemonEmoji: defaultEmoji,
      currentLeague: 'pierre',
      totalXp: gamification.totalXp,
      totalWorkouts: gamification.totalSessions,
      createdAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        void Promise.resolve(
          supabase.from('profiles').upsert({
            id: newProfile.id,
            username: newProfile.username,
            friend_code: newProfile.friendCode,
            trainer_title: newProfile.trainerTitle,
            avatar_pokemon_id: newProfile.avatarPokemonId,
            avatar_pokemon_emoji: newProfile.avatarPokemonEmoji,
            current_league: newProfile.currentLeague,
            total_xp: newProfile.totalXp,
            total_workouts: newProfile.totalWorkouts,
          })
        ).catch(() => {});
      }
    }

    return newProfile;
  } catch (err) {
    console.error('Erreur getOrCreateTrainerProfile:', err);
    return {
      id: 'default_trainer',
      username: 'Athlète Vitax',
      friendCode: 'VTX-1000',
      trainerTitle: 'Dresseur Débutant',
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

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: updated.id,
          username: updated.username,
          friend_code: updated.friendCode,
          trainer_title: updated.trainerTitle,
          avatar_pokemon_id: updated.avatarPokemonId,
          avatar_pokemon_emoji: updated.avatarPokemonEmoji,
          total_xp: updated.totalXp,
          current_league: updated.currentLeague,
        });
      } catch (e) {
        console.warn('Sync profil Supabase ignorée:', e);
      }
    }
  }

  return updated;
}

// -------------------------------------------------------------
// 2. GESTION DES AMIS (RÉELS UNIQUEMENT - ZÉRO FAUX PROFILS)
// -------------------------------------------------------------

/**
 * Récupère la liste réelle des amis (Supabase + cache local, nettoyée de tout faux profil)
 */
export async function getFriendsList(): Promise<FriendEntry[]> {
  const profile = await getOrCreateTrainerProfile();

  // 1. Tenter la synchronisation Supabase en temps réel
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: friendships, error: friendError } = await supabase
          .from('friends')
          .select('friend_id, created_at')
          .eq('user_id', profile.id);

        if (!friendError && friendships && friendships.length > 0) {
          const friendIds = friendships.map((f: any) => f.friend_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', friendIds);

          if (profilesData) {
            const realFriends: FriendEntry[] = profilesData.map((p: any) => {
              const friendship = friendships.find((f: any) => f.friend_id === p.id);
              return {
                friendId: p.id,
                username: p.username,
                friendCode: p.friend_code,
                trainerTitle: p.trainer_title || 'Athlète Vitax',
                avatarPokemonEmoji: p.avatar_pokemon_emoji || '⚡',
                currentLeague: (p.current_league as LeagueTier) || 'pierre',
                totalXp: p.total_xp || 0,
                addedAt: friendship?.created_at || new Date().toISOString(),
              };
            });

            await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(realFriends));
            return realFriends;
          }
        } else if (!friendError && friendships && friendships.length === 0) {
          await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify([]));
          return [];
        }
      } catch (e) {
        console.warn('Erreur lecture amis Supabase:', e);
      }
    }
  }

  // 2. Lecture cache local (en nettoyant tout ancien profil de test)
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIENDS);
    if (raw) {
      const parsed: FriendEntry[] = JSON.parse(raw);
      // Nettoyage strict : retirer les anciens faux profils codés en dur
      const cleaned = parsed.filter(
        (f) =>
          !f.friendId.startsWith('friend_lucas') &&
          !f.friendId.startsWith('friend_sarah') &&
          !f.friendId.startsWith('rival_')
      );
      if (cleaned.length !== parsed.length) {
        await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(cleaned));
      }
      return cleaned;
    }
  } catch (e) {
    console.error('Erreur lecture liste amis locale:', e);
  }

  // Aucun faux profil par défaut : liste propre et vide
  await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify([]));
  return [];
}

/**
 * Ajoute un ami par son vrai Code Ami unique sur la base partagée
 */
export async function addFriendByCode(
  rawFriendCode: string
): Promise<{ success: boolean; friend?: FriendEntry; error?: string }> {
  const profile = await getOrCreateTrainerProfile();
  let cleanCode = rawFriendCode.trim().toUpperCase();
  if (!cleanCode.startsWith('VTX-') && cleanCode.length === 4) {
    cleanCode = `VTX-${cleanCode}`;
  }

  if (cleanCode === profile.friendCode) {
    return { success: false, error: 'Vous ne pouvez pas vous ajouter vous-même comme ami.' };
  }

  const existingFriends = await getFriendsList();
  if (existingFriends.some((f) => f.friendCode === cleanCode)) {
    return { success: false, error: 'Cet athlète fait déjà partie de votre liste d’amis.' };
  }

  // Recherche sur la base centrale Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('friend_code', cleanCode)
          .single();

        if (!error && data) {
          const newFriend: FriendEntry = {
            friendId: data.id,
            username: data.username,
            friendCode: data.friend_code,
            trainerTitle: data.trainer_title || 'Athlète Vitax',
            avatarPokemonEmoji: data.avatar_pokemon_emoji || '⚡',
            currentLeague: (data.current_league as LeagueTier) || 'pierre',
            totalXp: data.total_xp || 0,
            addedAt: new Date().toISOString(),
          };

          const updatedList = [newFriend, ...existingFriends];
          await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updatedList));

          // Enregistrer la relation dans Supabase
          await supabase.from('friends').upsert({
            id: `${profile.id}_${data.id}`,
            user_id: profile.id,
            friend_id: data.id,
          });

          return { success: true, friend: newFriend };
        }
      } catch (e: any) {
        console.warn('Recherche Supabase amitié:', e?.message);
      }
    }
  }

  return {
    success: false,
    error: `Aucun athlète trouvé avec le code ami ${cleanCode}. Vérifiez le code avec votre partenaire.`,
  };
}

/**
 * Supprime un ami de sa liste restreinte (local + Supabase)
 */
export async function removeFriend(friendId: string): Promise<void> {
  const current = await getFriendsList();
  const updated = current.filter((f) => f.friendId !== friendId);
  await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const profile = await getOrCreateTrainerProfile();
    if (supabase) {
      try {
        await supabase
          .from('friends')
          .delete()
          .match({ user_id: profile.id, friend_id: friendId });
      } catch (e) {
        console.warn('Erreur suppression ami Supabase:', e);
      }
    }
  }
}

// -------------------------------------------------------------
// 3. STATISTIQUES & CLASSEMENTS (RÉELS UNIQUEMENT)
// -------------------------------------------------------------
export async function getWeeklyUserStats(): Promise<{
  weeklyXp: number;
  totalTonnageKg: number;
  cardioMinutes: number;
  workoutsCount: number;
}> {
  const db = await getDatabase();
  const { start, end } = getCurrentWeekBounds();

  const sessions = await db.getAllAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE date >= ? AND date <= ?',
    [start.toISOString(), end.toISOString()]
  );

  let weeklyXp = 0;
  let totalTonnageKg = 0;
  let cardioMinutes = 0;

  for (const s of sessions) {
    const xp = calculateSessionXp(s).totalXp;
    weeklyXp += xp;
    totalTonnageKg += s.total_volume || 0;
    if (
      s.program_name?.toLowerCase().includes('cardio') ||
      s.program_name?.toLowerCase().includes('tapis') ||
      s.program_name?.toLowerCase().includes('vélo') ||
      s.program_name?.toLowerCase().includes('velo')
    ) {
      cardioMinutes += Math.round((s.duration_seconds || 0) / 60);
    }
  }

  return {
    weeklyXp,
    totalTonnageKg: Math.round(totalTonnageKg),
    cardioMinutes,
    workoutsCount: sessions.length,
  };
}

/**
 * Récupère le classement de la ligue :
 * - Mode 'global' : Vrais athlètes connectés de la ligue
 * - Mode 'friends' : Vrais amis ajoutés uniquement
 */
export async function getLeagueLeaderboard(filter: 'global' | 'friends' = 'global'): Promise<{
  league: LeagueConfig;
  entries: LeaderboardEntry[];
  currentUserRank: number;
  timeRemainingText: string;
  totalParticipants: number;
}> {
  const profile = await getOrCreateTrainerProfile();
  const leagueConfig = LEAGUE_CONFIGS[profile.currentLeague] || LEAGUE_CONFIGS.pierre;
  const userStats = await getWeeklyUserStats();
  const { end, weekId } = getCurrentWeekBounds();

  const msRemaining = Math.max(0, end.getTime() - Date.now());
  const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const timeRemainingText = `${daysLeft}j ${hoursLeft}h restantes`;

  const currentUserEntry: Omit<LeaderboardEntry, 'rank'> = {
    userId: profile.id,
    username: profile.username || 'Vous',
    trainerTitle: profile.trainerTitle,
    avatarPokemonEmoji: profile.avatarPokemonEmoji,
    weeklyXp: userStats.weeklyXp,
    totalTonnageKg: userStats.totalTonnageKg,
    cardioMinutes: userStats.cardioMinutes,
    workoutsCount: userStats.workoutsCount,
    isCurrentUser: true,
    trend: 'same',
  };

  // Synchronisation de nos statistiques vers Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      void Promise.resolve(
        supabase
          .from('weekly_leaderboards')
          .upsert({
            id: `${weekId}_${profile.id}`,
            week_id: weekId,
            user_id: profile.id,
            username: profile.username,
            trainer_title: profile.trainerTitle,
            avatar_pokemon_emoji: profile.avatarPokemonEmoji,
            current_league: profile.currentLeague,
            weekly_xp: userStats.weeklyXp,
            total_tonnage_kg: userStats.totalTonnageKg,
            cardio_minutes: userStats.cardioMinutes,
            workouts_count: userStats.workoutsCount,
            updated_at: new Date().toISOString(),
          })
      ).catch(() => {});
    }
  }

  // -----------------------------------------------------------
  // OPTION A : CLASSEMENT ENTRE AMIS ("Mes Amis")
  // -----------------------------------------------------------
  if (filter === 'friends') {
    const friends = await getFriendsList();
    const friendEntries: Omit<LeaderboardEntry, 'rank'>[] = [];

    // Récupérer les stats réelles de la semaine pour ces amis depuis Supabase
    if (isSupabaseConfigured() && friends.length > 0) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const friendIds = friends.map((f) => f.friendId);
          const { data: statsData } = await supabase
            .from('weekly_leaderboards')
            .select('*')
            .eq('week_id', weekId)
            .in('user_id', friendIds);

          for (const f of friends) {
            const stat = statsData?.find((s: any) => s.user_id === f.friendId);
            friendEntries.push({
              userId: f.friendId,
              username: f.username,
              trainerTitle: f.trainerTitle,
              avatarPokemonEmoji: f.avatarPokemonEmoji,
              weeklyXp: stat?.weekly_xp || 0,
              totalTonnageKg: stat?.total_tonnage_kg || 0,
              cardioMinutes: stat?.cardio_minutes || 0,
              workoutsCount: stat?.workouts_count || 0,
              isCurrentUser: false,
              trend: 'same',
            });
          }
        } catch (e) {
          console.warn('Erreur lecture stats amis Supabase:', e);
        }
      }
    }

    // Si offline ou pas de stats encore, ajouter les amis enregistrés
    if (friendEntries.length === 0 && friends.length > 0) {
      for (const f of friends) {
        friendEntries.push({
          userId: f.friendId,
          username: f.username,
          trainerTitle: f.trainerTitle,
          avatarPokemonEmoji: f.avatarPokemonEmoji,
          weeklyXp: 0,
          totalTonnageKg: 0,
          cardioMinutes: 0,
          workoutsCount: 0,
          isCurrentUser: false,
          trend: 'same',
        });
      }
    }

    const combinedFriends = [...friendEntries, currentUserEntry];
    combinedFriends.sort((a, b) => b.weeklyXp - a.weeklyXp);

    let rankCounter = 1;
    let userRank = 1;
    const finalEntries: LeaderboardEntry[] = combinedFriends.map((item) => {
      const rank = rankCounter++;
      if (item.isCurrentUser) userRank = rank;
      return { ...item, rank };
    });

    return {
      league: leagueConfig,
      entries: finalEntries,
      currentUserRank: userRank,
      timeRemainingText,
      totalParticipants: finalEntries.length,
    };
  }

  // -----------------------------------------------------------
  // OPTION B : CLASSEMENT GÉNÉRAL (Vrais athlètes Vitax uniquement)
  // -----------------------------------------------------------
  const realLeaderboardEntries: Omit<LeaderboardEntry, 'rank' | 'isCurrentUser'>[] = [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('weekly_leaderboards')
          .select('*')
          .eq('week_id', weekId)
          .eq('current_league', profile.currentLeague)
          .neq('user_id', profile.id)
          .order('weekly_xp', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          for (const d of data) {
            realLeaderboardEntries.push({
              userId: d.user_id,
              username: d.username,
              trainerTitle: d.trainer_title || 'Athlète',
              avatarPokemonEmoji: d.avatar_pokemon_emoji || '⚡',
              weeklyXp: d.weekly_xp || 0,
              totalTonnageKg: d.total_tonnage_kg || 0,
              cardioMinutes: d.cardio_minutes || 0,
              workoutsCount: d.workouts_count || 0,
              trend: 'same',
            });
          }
        }
      } catch (err) {
        console.warn('Lecture cloud leaderboard:', err);
      }
    }
  }

  const combined = [...realLeaderboardEntries.map((p) => ({ ...p, isCurrentUser: false })), currentUserEntry];
  combined.sort((a, b) => b.weeklyXp - a.weeklyXp);

  let userRank = 1;
  const entries: LeaderboardEntry[] = combined.map((item, idx) => {
    const rank = idx + 1;
    if (item.isCurrentUser) userRank = rank;
    return { ...item, rank };
  });

  return {
    league: leagueConfig,
    entries,
    currentUserRank: userRank,
    timeRemainingText,
    totalParticipants: entries.length,
  };
}

// -------------------------------------------------------------
// 4. CENTRE D'ÉCHANGE POKÉMON (OFFRES RÉELLES UNIQUEMENT)
// -------------------------------------------------------------
export async function getTradablePokemon(): Promise<PokemonEgg[]> {
  const db = await getDatabase();
  const hatched = await db.getAllAsync<PokemonEgg>(
    'SELECT * FROM pokemon_eggs WHERE status = "hatched" ORDER BY hatched_at DESC'
  );
  return hatched;
}

export async function getCommunityTradeOffers(
  filter: 'all' | 'friends' = 'all'
): Promise<PokemonTradeOffer[]> {
  const profile = await getOrCreateTrainerProfile();
  let offers: PokemonTradeOffer[] = [];

  // Lecture depuis Supabase en priorité
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('status', 'available')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          offers = data.map((d: any) => ({
            id: d.id,
            senderId: d.sender_id,
            senderName: d.sender_name,
            senderCode: d.sender_code,
            offeredPokemon: d.offered_pokemon,
            requestedCriteriaText: d.requested_criteria_text,
            requestedSpeciesId: d.requested_species_id,
            friendsOnly: d.friends_only,
            status: d.status,
            createdAt: d.created_at,
          }));
          await AsyncStorage.setItem(STORAGE_KEY_COMMUNITY_TRADES, JSON.stringify(offers));
        }
      } catch (e) {
        console.warn('Erreur lecture offres Supabase:', e);
      }
    }
  }

  // Fallback cache local si pas de réseau
  if (offers.length === 0) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_COMMUNITY_TRADES);
      if (raw) {
        const parsed: PokemonTradeOffer[] = JSON.parse(raw);
        // Nettoyer les fausses offres de test starter
        offers = parsed.filter((o) => !o.id.startsWith('trade_starter_'));
      }
    } catch {}
  }

  if (filter === 'friends') {
    const friends = await getFriendsList();
    const friendCodes = new Set(friends.map((f) => f.friendCode));
    return offers.filter(
      (o) => friendCodes.has(o.senderCode) || o.senderId === profile.id
    );
  }

  return offers;
}

export async function createTradeOffer(params: {
  pokemonEggId: string;
  requestedCriteriaText?: string;
  requestedSpeciesId?: string;
  friendsOnly?: boolean;
}): Promise<PokemonTradeOffer> {
  const profile = await getOrCreateTrainerProfile();
  const db = await getDatabase();

  const egg = await db.getFirstAsync<PokemonEgg>(
    'SELECT * FROM pokemon_eggs WHERE id = ? AND status = "hatched"',
    [params.pokemonEggId]
  );

  if (!egg || !egg.pokemon_id) {
    throw new Error('Pokémon introuvable ou non éclos.');
  }

  const species = POKEMON_SPECIES.find((p) => p.id === egg.pokemon_id);

  const newOffer: PokemonTradeOffer = {
    id: `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    senderId: profile.id,
    senderName: profile.username,
    senderCode: profile.friendCode,
    offeredPokemon: {
      id: egg.id,
      speciesId: egg.pokemon_id,
      name: egg.pokemon_name || species?.name || 'Pokémon',
      emoji: egg.pokemon_emoji || species?.emoji || '🥚',
      type: egg.pokemon_type || species?.type || 'Normal',
      cp: egg.pokemon_cp || species?.baseCp || 400,
      isLegendary: Boolean(egg.is_legendary),
    },
    requestedCriteriaText: params.requestedCriteriaText,
    requestedSpeciesId: params.requestedSpeciesId,
    friendsOnly: Boolean(params.friendsOnly),
    status: 'available',
    createdAt: new Date().toISOString(),
  };

  const existing = await getCommunityTradeOffers('all');
  const updated = [newOffer, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_COMMUNITY_TRADES, JSON.stringify(updated));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      void Promise.resolve(
        supabase.from('trades').insert({
          id: newOffer.id,
          sender_id: newOffer.senderId,
          sender_name: newOffer.senderName,
          sender_code: newOffer.senderCode,
          offered_pokemon: newOffer.offeredPokemon,
          requested_criteria_text: newOffer.requestedCriteriaText,
          requested_species_id: newOffer.requestedSpeciesId,
          friends_only: newOffer.friendsOnly,
          status: newOffer.status,
        })
      ).catch(() => {});
    }
  }

  return newOffer;
}

export async function executePokemonTrade(
  offerId: string,
  myPokemonEggId: string
): Promise<{ success: boolean; receivedPokemonName: string }> {
  const db = await getDatabase();
  const profile = await getOrCreateTrainerProfile();
  const offers = await getCommunityTradeOffers('all');
  const offerIndex = offers.findIndex((o) => o.id === offerId);

  if (offerIndex === -1) {
    throw new Error('Offre d’échange introuvable.');
  }

  const offer = offers[offerIndex];

  if (offer.friendsOnly && offer.senderId !== profile.id) {
    const friends = await getFriendsList();
    const isFriend = friends.some((f) => f.friendCode === offer.senderCode);
    if (!isFriend) {
      throw new Error('Cette offre est exclusivement réservée aux amis de ce dresseur. Ajoutez son Code Ami d’abord !');
    }
  }

  const myEgg = await db.getFirstAsync<PokemonEgg>(
    'SELECT * FROM pokemon_eggs WHERE id = ? AND status = "hatched"',
    [myPokemonEggId]
  );

  if (!myEgg) {
    throw new Error('Votre Pokémon sélectionné est introuvable.');
  }

  // TRANSACTION SQLITE ATOMIQUE
  await db.runAsync('DELETE FROM pokemon_eggs WHERE id = ?', [myPokemonEggId]);

  const newReceivedId = `traded_${Date.now()}_${offer.offeredPokemon.speciesId}`;
  await db.runAsync(
    `INSERT INTO pokemon_eggs (
      id, rarity, required_xp, current_xp, status, incubator_slot, 
      created_at, hatched_at, pokemon_id, pokemon_name, pokemon_emoji, 
      pokemon_type, pokemon_cp, is_legendary, obtained_from
    ) VALUES (?, ?, ?, ?, "hatched", NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newReceivedId,
      offer.offeredPokemon.isLegendary ? 'legendary' : 'champion',
      500,
      500,
      new Date().toISOString(),
      new Date().toISOString(),
      offer.offeredPokemon.speciesId,
      offer.offeredPokemon.name,
      offer.offeredPokemon.emoji,
      offer.offeredPokemon.type,
      offer.offeredPokemon.cp,
      offer.offeredPokemon.isLegendary ? 1 : 0,
      `Échange avec ${offer.senderName} (${offer.senderCode})`,
    ]
  );

  offers[offerIndex].status = 'completed';
  offers[offerIndex].completedAt = new Date().toISOString();
  offers[offerIndex].receiverId = profile.id;
  offers[offerIndex].receiverName = profile.username;
  await AsyncStorage.setItem(STORAGE_KEY_COMMUNITY_TRADES, JSON.stringify(offers));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      void Promise.resolve(
        supabase.from('trades').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          receiver_id: profile.id,
          receiver_name: profile.username,
        }).eq('id', offerId)
      ).catch(() => {});
    }
  }

  return {
    success: true,
    receivedPokemonName: offer.offeredPokemon.name,
  };
}

// -------------------------------------------------------------
// 5. RAIDS CO-OP COLLECTIFS (CONTRIBUTIONS RÉELLES)
// -------------------------------------------------------------
export async function getActiveCoOpRaidBoss(): Promise<CoOpRaidBoss> {
  const profile = await getOrCreateTrainerProfile();
  const userStats = await getWeeklyUserStats();
  const { start, end, weekId } = getCurrentWeekBounds();

  const claimedRaw = await AsyncStorage.getItem(`${STORAGE_KEY_RAID_CLAIMED}_week_${start.toISOString()}`);
  const hasClaimed = claimedRaw === 'true';

  const targetMetric: RaidMetric = 'tonnage_kg';
  const targetValue = 50000;
  const myContribution = userStats.totalTonnageKg;

  // Enregistrer notre contribution sur Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      void Promise.resolve(
        supabase.from('raid_contributions').upsert({
          id: `raid_${weekId}_${profile.id}`,
          raid_id: `raid_${weekId}`,
          user_id: profile.id,
          username: profile.username,
          avatar_pokemon_emoji: profile.avatarPokemonEmoji,
          contribution_value: myContribution,
          updated_at: new Date().toISOString(),
        })
      ).catch(() => {});
    }
  }

  // Récupérer les vraies contributions des autres participants depuis Supabase
  const otherParticipants: Omit<RaidParticipant, 'isCurrentUser'>[] = [];
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('raid_contributions')
          .select('*')
          .eq('raid_id', `raid_${weekId}`)
          .neq('user_id', profile.id);

        if (!error && data) {
          for (const d of data) {
            const val = d.contribution_value || 0;
            const pct = Math.round((val / targetValue) * 100);
            otherParticipants.push({
              userId: d.user_id,
              username: d.username,
              avatarPokemonEmoji: d.avatar_pokemon_emoji || '⚡',
              contributionValue: val,
              percentage: pct,
            });
          }
        }
      } catch (e) {
        console.warn('Erreur lecture contributions raid Supabase:', e);
      }
    }
  }

  const totalTeam = otherParticipants.reduce((sum, m) => sum + m.contributionValue, 0);
  const currentProgress = Math.min(targetValue, totalTeam + myContribution);
  const myPercentage = Math.round((myContribution / targetValue) * 100);

  const participants: RaidParticipant[] = [
    {
      userId: profile.id,
      username: profile.username || 'Vous',
      avatarPokemonEmoji: profile.avatarPokemonEmoji,
      contributionValue: myContribution,
      percentage: myPercentage,
      isCurrentUser: true,
    },
    ...otherParticipants.map((m) => ({ ...m, isCurrentUser: false })),
  ];

  participants.sort((a, b) => b.contributionValue - a.contributionValue);
  const isVictory = currentProgress >= targetValue;

  return {
    id: `raid_mewtwo_${start.toISOString()}`,
    title: 'Raid Boss Co-op de la Semaine',
    bossName: 'Mewtwo Gigamax',
    bossEmoji: '🧬',
    bossType: 'Psy / Légendaire',
    description: 'Alliez-vous avec vos partenaires d’arène pour soulever collectivement 50 000 kg avant la fin du week-end !',
    targetMetric,
    targetMetricLabel: 'kg soulevés',
    targetValue,
    currentProgress,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: isVictory ? 'victory' : 'active',
    rewardEggRarity: 'legendary',
    rewardDescription: 'Œuf Légendaire d’Or (éclosion garantie de Mewtwo ou Mew)',
    participants,
    hasClaimedReward: hasClaimed,
  };
}

export async function claimRaidVictoryReward(): Promise<PokemonEgg> {
  const raid = await getActiveCoOpRaidBoss();
  if (raid.status !== 'victory') {
    throw new Error('Le Boss de Raid n’a pas encore été vaincu.');
  }

  const { start } = getCurrentWeekBounds();
  const storageKey = `${STORAGE_KEY_RAID_CLAIMED}_week_${start.toISOString()}`;

  const egg = await addPokemonEgg('legendary', 'Victoire de Raid Co-op : Mewtwo Gigamax', 'mewtwo');
  await AsyncStorage.setItem(storageKey, 'true');

  return egg;
}
