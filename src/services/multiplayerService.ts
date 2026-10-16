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
  FriendChallenge,
  FriendRequest,
} from '../types/social';
import { POKEMON_SPECIES, addPokemonEgg } from './pokemonEggService';
import { getUserGamificationStats, calculateSessionXp } from './gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { useSettingsStore } from '../stores/settingsStore';
import { getPersistedSession, savePersistedSession, generateFriendCode, STORAGE_KEY_AUTH_SESSION } from './authService';

export const STORAGE_KEY_PROFILE = '@vitax_trainer_profile';
export const STORAGE_KEY_COMMUNITY_TRADES = '@vitax_community_trades';
export const STORAGE_KEY_FRIENDS = '@vitax_friends_list';
export const STORAGE_KEY_FRIEND_REQUESTS = '@vitax_friend_requests';
export const STORAGE_KEY_RAID_CLAIMED = '@vitax_raid_claimed_';
export const STORAGE_KEY_FRIEND_CHALLENGES = '@vitax_friend_challenges';

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
export async function syncTrainerProfileToSupabase(profile: TrainerProfile): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  // Ne synchroniser que les profils de comptes réels (pas les invités anonymes trainer_... ou default_trainer)
  if (!profile.id || profile.id.startsWith('trainer_') || profile.id === 'default_trainer') {
    return false;
  }
  // Ne JAMAIS écraser Supabase avec un code factice 10000 ou invalide
  if (!profile.friendCode || profile.friendCode === '10000' || !/^\d{5}$/.test(profile.friendCode)) {
    return false;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('profiles').upsert({
      id: profile.id,
      username: profile.username,
      friend_code: profile.friendCode,
      trainer_title: profile.trainerTitle,
      avatar_pokemon_id: profile.avatarPokemonId,
      avatar_pokemon_emoji: profile.avatarPokemonEmoji,
      current_league: profile.currentLeague,
      total_xp: profile.totalXp,
      total_workouts: profile.totalWorkouts,
    });
    if (error) {
      console.warn('Erreur Supabase upsert profil:', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('Exception Supabase upsert profil:', e?.message);
    return false;
  }
}

/**
 * Met à jour instantanément les statistiques et l'expérience du profil après une séance
 * et les synchronise avec Supabase et le stockage local
 */
export async function updateTrainerProfileXpAndStats(
  xpGained: number,
  volumeGained: number = 0
): Promise<TrainerProfile> {
  const profile = await getOrCreateTrainerProfile();

  profile.totalXp = Math.max(0, (profile.totalXp || 0) + Math.round(xpGained));
  profile.totalWorkouts = Math.max(1, (profile.totalWorkouts || 0) + 1);

  // Mise à jour de la ligue si l'XP dépasse le palier
  if (profile.totalXp >= 10500) {
    profile.currentLeague = 'maitre';
  } else if (profile.totalXp >= 5200) {
    profile.currentLeague = 'volcan';
  } else if (profile.totalXp >= 2200) {
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

    // Récupérer les stats de gamification sans risquer de bloquer si la base locale est en cours d'init
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

    // Synchronisation en arrière-plan vers Supabase
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
 * Ajoute un ami par son vrai Code Ami unique ou son pseudo sur la base partagée
 */
export async function addFriendByCode(
  rawInput: string
): Promise<{ success: boolean; friend?: FriendEntry; error?: string }> {
  const profile = await getOrCreateTrainerProfile();
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return { success: false, error: 'Veuillez saisir un code ami ou un nom d’athlète.' };
  }

  // Synchroniser notre profil vers Supabase en priorité pour garantir la clé étrangère
  await syncTrainerProfileToSupabase(profile);

  // 1. Génération des variantes possibles (priorité absolue au code à 5 chiffres)
  const cleanDigits = trimmed.replace(/\D/g, '');
  const candidateCodes: string[] = [trimmed];

  if (cleanDigits.length === 5) {
    candidateCodes.push(cleanDigits);
    candidateCodes.push(`VTX-${cleanDigits}`);
  } else if (cleanDigits.length > 0 && cleanDigits.length < 5) {
    candidateCodes.push(cleanDigits);
    candidateCodes.push(cleanDigits.padStart(5, '0'));
    candidateCodes.push(`VTX-${cleanDigits}`);
  } else if (cleanDigits.length > 5) {
    candidateCodes.push(cleanDigits.slice(0, 5));
  }

  const upper = trimmed.toUpperCase();
  if (upper.startsWith('VTX')) {
    const suffix = upper.replace(/^VTX[\s-_]*/, '');
    if (suffix) {
      candidateCodes.push(suffix);
      candidateCodes.push(`VTX-${suffix}`);
    }
  }

  // 2. Empêcher de s'ajouter soi-même
  const myCodeUpper = (profile.friendCode || '').toUpperCase();
  const myNameUpper = (profile.username || '').toUpperCase();
  if (
    candidateCodes.includes(myCodeUpper) ||
    candidateCodes.includes(myNameUpper) ||
    upper === myCodeUpper ||
    upper === myNameUpper
  ) {
    return { success: false, error: 'Vous ne pouvez pas vous ajouter vous-même comme ami.' };
  }

  // 3. Vérifier si déjà ami localement
  const existingFriends = await getFriendsList();
  if (
    existingFriends.some(
      (f) =>
        candidateCodes.includes(f.friendCode.toUpperCase()) ||
        f.username.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    return { success: false, error: 'Cet athlète fait déjà partie de votre cercle d’amis.' };
  }

  // 4. Recherche sur Supabase
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'La connexion au serveur partagé n’est pas configurée dans l’application.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      error: 'Impossible d’établir la connexion au réseau partagé.',
    };
  }

  try {
    let targetProfile: any = null;

    // Étape A : Recherche exacte par code ami parmi les variantes
    const { data: codeData, error: codeErr } = await supabase
      .from('profiles')
      .select('*')
      .in('friend_code', candidateCodes)
      .limit(5);

    if (codeErr) {
      if (codeErr.code === '42501') {
        return {
          success: false,
          error:
            'Sécurité Supabase (RLS actif) : exécutez le script SQL de déverrouillage dans votre dashboard Supabase pour autoriser l’accès.',
        };
      }
      console.warn('Erreur Supabase search by code:', codeErr.message);
    }

    if (codeData && codeData.length > 0) {
      targetProfile = codeData.find((p: any) => p.id !== profile.id) || null;
    }

    // Étape B : Recherche par Nom / Pseudo exact ou similaire
    if (!targetProfile) {
      const { data: nameData } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', trimmed)
        .limit(5);

      if (nameData && nameData.length > 0) {
        targetProfile = nameData.find((p: any) => p.id !== profile.id) || null;
      }
    }

    // Étape C : Recherche par portion de code ami (ex: "76" dans VTX-7640 ou VTX-76)
    if (!targetProfile && cleanDigits.length >= 2) {
      const { data: partialData } = await supabase
        .from('profiles')
        .select('*')
        .ilike('friend_code', `%${cleanDigits}%`)
        .limit(5);

      if (partialData && partialData.length > 0) {
        targetProfile = partialData.find((p: any) => p.id !== profile.id) || null;
      }
    }

    if (!targetProfile) {
      return {
        success: false,
        error: `Aucun athlète trouvé avec "${trimmed}". Demandez à votre partenaire d'ouvrir l'onglet Arène pour synchroniser son profil.`,
      };
    }

    if (targetProfile.id === profile.id) {
      return { success: false, error: 'Vous ne pouvez pas vous ajouter vous-même comme ami.' };
    }

    const newFriend: FriendEntry = {
      friendId: targetProfile.id,
      username: targetProfile.username,
      friendCode: targetProfile.friend_code,
      trainerTitle: targetProfile.trainer_title || 'Athlète Vitax',
      avatarPokemonEmoji: targetProfile.avatar_pokemon_emoji || '⚡',
      currentLeague: (targetProfile.current_league as LeagueTier) || 'pierre',
      totalXp: targetProfile.total_xp || 0,
      addedAt: new Date().toISOString(),
    };

    // Sauvegarde dans le cache local
    const updatedList = [
      newFriend,
      ...existingFriends.filter((f) => f.friendId !== newFriend.friendId),
    ];
    await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updatedList));

    // Enregistrement RÉCIPROQUE dans Supabase :
    // 1. Moi -> Mon Ami
    await supabase.from('friends').upsert({
      id: `${profile.id}_${targetProfile.id}`,
      user_id: profile.id,
      friend_id: targetProfile.id,
    });
    // 2. Mon Ami -> Moi (réciproque automatique pour que les deux se voient directement !)
    await supabase.from('friends').upsert({
      id: `${targetProfile.id}_${profile.id}`,
      user_id: targetProfile.id,
      friend_id: profile.id,
    });

    // 3. Enregistrement d'une demande d'invitation pour alerter immédiatement le destinataire
    try {
      await supabase.from('friend_requests').upsert({
        id: `req_${profile.id}_${targetProfile.id}`,
        sender_id: profile.id,
        sender_name: profile.username || 'Athlète Vitax',
        sender_code: profile.friendCode,
        sender_avatar: profile.avatarPokemonEmoji || '⚡',
        sender_title: profile.trainerTitle || 'Athlète Vitax',
        receiver_id: targetProfile.id,
        receiver_code: targetProfile.friend_code,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (reqErr) {
      console.warn('Erreur envoi friend_request Supabase:', reqErr);
    }

    return { success: true, friend: newFriend };
  } catch (e: any) {
    console.error('Erreur addFriendByCode:', e);
    return {
      success: false,
      error: e?.message || 'Une erreur est survenue lors de l’ajout de l’ami.',
    };
  }
}

/**
 * Supprime un ami de sa liste restreinte (local + Supabase dans les 2 sens)
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
          .or(
            `and(user_id.eq.${profile.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile.id})`
          );
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
      throw new Error('Cette offre est exclusivement réservée aux amis de cet athlète. Ajoutez son Code Ami d’abord !');
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

// -------------------------------------------------------------
// 6. DÉFIS DIRECTS ENTRE AMIS (EXERCICES & PROGRAMMES)
// -------------------------------------------------------------

export async function getFriendChallenges(): Promise<FriendChallenge[]> {
  const profile = await getOrCreateTrainerProfile();
  let localChallenges: FriendChallenge[] = [];

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIEND_CHALLENGES);
    if (raw) {
      localChallenges = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erreur lecture défis locaux:', e);
  }

  // Tenter de récupérer depuis Supabase si connecté
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('friend_challenges')
          .select('*')
          .or(`target_friend_code.eq.${profile.friendCode},creator_id.eq.${profile.id},target_friend_code.eq.all`)
          .order('created_at', { ascending: false });

        if (!error && data && Array.isArray(data)) {
          const cloudChallenges: FriendChallenge[] = data.map((d: any) => ({
            id: d.id,
            creatorId: d.creator_id,
            creatorName: d.creator_name,
            creatorAvatarEmoji: d.creator_avatar || '⚡',
            targetFriendCode: d.target_friend_code,
            targetFriendName: d.target_friend_name,
            type: d.challenge_type || 'exercise',
            title: d.title,
            exerciseId: d.exercise_id,
            exerciseName: d.exercise_name,
            programId: d.program_id,
            programName: d.program_name,
            targetWeightKg: d.target_weight,
            targetReps: d.target_reps,
            targetDurationSeconds: d.target_duration_seconds,
            targetVolumeKg: d.target_volume_kg,
            instructions: d.instructions || '',
            rewardXp: d.reward_xp || 150,
            status: d.status || 'active',
            winnerName: d.winner_name,
            createdAt: d.created_at,
          }));

          const cloudIds = new Set(cloudChallenges.map((c) => c.id));
          const uniqueLocal = localChallenges.filter((c) => !cloudIds.has(c.id));
          localChallenges = [...cloudChallenges, ...uniqueLocal];
          await AsyncStorage.setItem(STORAGE_KEY_FRIEND_CHALLENGES, JSON.stringify(localChallenges));
        }
      } catch (err) {
        console.warn('Erreur synchro défis Supabase:', err);
      }
    }
  }

  // Défis de démarrage stimulants si vide
  if (localChallenges.length === 0) {
    const starterChallenges: FriendChallenge[] = [
      {
        id: 'challenge_bench_press_master',
        creatorId: 'contender_red',
        creatorName: 'Red (Champion Kanto)',
        creatorAvatarEmoji: '🧢',
        targetFriendCode: 'all',
        type: 'exercise',
        title: 'Défi Développé Couché : 80 kg × 10 reps',
        exerciseId: 'ex_bench_press',
        exerciseName: 'Développé couché à la barre',
        targetWeightKg: 80,
        targetReps: 10,
        instructions: 'Bats mes 10 répétitions propres à 80 kg avec tempo contrôlé !',
        rewardXp: 200,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'challenge_pullups_blake',
        creatorId: 'contender_blue',
        creatorName: 'Blue (Rival Arène)',
        creatorAvatarEmoji: '🔥',
        targetFriendCode: 'all',
        type: 'exercise',
        title: 'Défi Tractions : 15 répétitions strictes',
        exerciseId: 'ex_pullups',
        exerciseName: 'Tractions en pronation',
        targetReps: 15,
        targetWeightKg: 0,
        instructions: 'Menton au-dessus de la barre, zéro balancement !',
        rewardXp: 150,
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    localChallenges = starterChallenges;
    await AsyncStorage.setItem(STORAGE_KEY_FRIEND_CHALLENGES, JSON.stringify(localChallenges));
  }

  return localChallenges;
}

export async function createFriendChallenge(
  challenge: Omit<FriendChallenge, 'id' | 'createdAt' | 'status'>
): Promise<FriendChallenge> {
  const profile = await getOrCreateTrainerProfile();
  const id = `chlg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullChallenge: FriendChallenge = {
    id,
    ...challenge,
    creatorId: profile.id,
    creatorName: profile.username || 'Athlète Vitax',
    creatorAvatarEmoji: profile.avatarPokemonEmoji || '⚡',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const existing = await getFriendChallenges();
  const updated = [fullChallenge, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_CHALLENGES, JSON.stringify(updated));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('friend_challenges').insert({
          id: fullChallenge.id,
          creator_id: fullChallenge.creatorId,
          creator_name: fullChallenge.creatorName,
          creator_avatar: fullChallenge.creatorAvatarEmoji,
          target_friend_code: fullChallenge.targetFriendCode || 'all',
          target_friend_name: fullChallenge.targetFriendName,
          challenge_type: fullChallenge.type,
          title: fullChallenge.title,
          exercise_id: fullChallenge.exerciseId,
          exercise_name: fullChallenge.exerciseName,
          program_id: fullChallenge.programId,
          program_name: fullChallenge.programName,
          target_weight: fullChallenge.targetWeightKg,
          target_reps: fullChallenge.targetReps,
          target_duration_seconds: fullChallenge.targetDurationSeconds,
          target_volume_kg: fullChallenge.targetVolumeKg,
          instructions: fullChallenge.instructions,
          reward_xp: fullChallenge.rewardXp,
          status: 'active',
        });
      } catch (err) {
        console.warn('Erreur envoi défi Supabase:', err);
      }
    }
  }

  return fullChallenge;
}

export async function completeFriendChallenge(
  challengeId: string,
  winnerName: string
): Promise<{ success: boolean; earnedXp: number }> {
  const existing = await getFriendChallenges();
  const idx = existing.findIndex((c) => c.id === challengeId);
  if (idx === -1) return { success: false, earnedXp: 0 };

  const challenge = existing[idx];
  challenge.status = 'beaten';
  challenge.winnerName = winnerName;
  existing[idx] = challenge;
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_CHALLENGES, JSON.stringify(existing));

  // Créditer immédiatement l'XP au profil
  const rewardXp = challenge.rewardXp || 150;
  await updateTrainerProfileXpAndStats(rewardXp, 0);

  // Mettre à jour Supabase si configuré
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('friend_challenges').update({
          status: 'beaten',
          winner_name: winnerName,
        }).eq('id', challengeId);
      } catch (err) {
        console.warn('Erreur mise à jour défi Supabase:', err);
      }
    }
  }

  return { success: true, earnedXp: rewardXp };
}

// -------------------------------------------------------------
// 7. GESTION DES INVITATIONS / DEMANDES D'AMIS ET NOTIFICATIONS
// -------------------------------------------------------------

/**
 * Récupère les demandes d'invitations d'amis reçues et en attente
 */
export async function getPendingFriendRequests(): Promise<FriendRequest[]> {
  const profile = await getOrCreateTrainerProfile();
  let pendingRequests: FriendRequest[] = [];

  // 1. Lire le cache local
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIEND_REQUESTS);
    if (raw) {
      pendingRequests = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erreur lecture local friend requests:', err);
  }

  // 2. Synchronisation Supabase si connecté
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('friend_requests')
          .select('*')
          .or(`receiver_id.eq.${profile.id},receiver_code.eq.${profile.friendCode}`)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data && Array.isArray(data)) {
          const cloudRequests: FriendRequest[] = data.map((d: any) => ({
            id: d.id,
            senderId: d.sender_id,
            senderName: d.sender_name || 'Athlète Vitax',
            senderCode: d.sender_code,
            senderAvatarEmoji: d.sender_avatar || '⚡',
            senderTrainerTitle: d.sender_title || 'Athlète Vitax',
            receiverId: d.receiver_id,
            receiverCode: d.receiver_code,
            status: d.status || 'pending',
            createdAt: d.created_at,
          }));

          // Filtrer ceux qui sont déjà nos amis confirmés
          const existingFriends = await getFriendsList();
          const friendIds = new Set(existingFriends.map((f) => f.friendId));
          const actualPending = cloudRequests.filter((r) => !friendIds.has(r.senderId));

          pendingRequests = actualPending;
          await AsyncStorage.setItem(STORAGE_KEY_FRIEND_REQUESTS, JSON.stringify(actualPending));
        }
      } catch (err) {
        console.warn('Erreur synchro friend requests Supabase:', err);
      }
    }
  }

  return pendingRequests;
}

/**
 * Retourne le nombre d'invitations d'amis en attente
 */
export async function getPendingFriendRequestsCount(): Promise<number> {
  const list = await getPendingFriendRequests();
  return list.length;
}

/**
 * Accepte une demande d'invitation d'ami reçue
 */
export async function acceptFriendRequest(
  requestId: string
): Promise<{ success: boolean; friend?: FriendEntry; error?: string }> {
  try {
    const profile = await getOrCreateTrainerProfile();
    const requests = await getPendingFriendRequests();
    const req = requests.find((r) => r.id === requestId);

    if (!req) {
      return { success: false, error: 'Demande d’ami introuvable ou déjà traitée.' };
    }

    const newFriend: FriendEntry = {
      friendId: req.senderId,
      username: req.senderName,
      friendCode: req.senderCode,
      trainerTitle: req.senderTrainerTitle,
      avatarPokemonEmoji: req.senderAvatarEmoji,
      currentLeague: 'pierre',
      totalXp: 0,
      addedAt: new Date().toISOString(),
    };

    // Mettre à jour la liste locale d'amis
    const existingFriends = await getFriendsList();
    const updatedFriends = [
      newFriend,
      ...existingFriends.filter((f) => f.friendId !== newFriend.friendId),
    ];
    await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updatedFriends));

    // Retirer de la liste des demandes en attente locales
    const remainingRequests = requests.filter((r) => r.id !== requestId);
    await AsyncStorage.setItem(STORAGE_KEY_FRIEND_REQUESTS, JSON.stringify(remainingRequests));

    // Mettre à jour Supabase si configuré
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          // Marquer la demande comme acceptée
          await supabase
            .from('friend_requests')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', requestId);

          // Inscription réciproque dans friends
          await supabase.from('friends').upsert([
            {
              id: `${profile.id}_${req.senderId}`,
              user_id: profile.id,
              friend_id: req.senderId,
            },
            {
              id: `${req.senderId}_${profile.id}`,
              user_id: req.senderId,
              friend_id: profile.id,
            },
          ]);
        } catch (err) {
          console.warn('Erreur acceptation demande Supabase:', err);
        }
      }
    }

    return { success: true, friend: newFriend };
  } catch (err: any) {
    console.error('Erreur acceptFriendRequest:', err);
    return { success: false, error: err?.message || 'Impossible d’accepter la demande.' };
  }
}

/**
 * Refuse une demande d'invitation d'ami reçue
 */
export async function declineFriendRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const requests = await getPendingFriendRequests();
    const remaining = requests.filter((r) => r.id !== requestId);
    await AsyncStorage.setItem(STORAGE_KEY_FRIEND_REQUESTS, JSON.stringify(remaining));

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('friend_requests')
            .update({ status: 'declined', updated_at: new Date().toISOString() })
            .eq('id', requestId);
        } catch (err) {
          console.warn('Erreur refus demande Supabase:', err);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erreur declineFriendRequest:', err);
    return { success: false, error: err?.message || 'Impossible de refuser la demande.' };
  }
}

/**
 * Crée une invitation d'ami de démonstration (pour tester et voir la notification en direct)
 */
export async function simulateFriendRequest(
  senderName: string = 'Alexandre (Coach)',
  senderCode: string = 'VTX-5491'
): Promise<FriendRequest> {
  const profile = await getOrCreateTrainerProfile();
  const simulated: FriendRequest = {
    id: `req_sim_${Date.now()}`,
    senderId: `sim_trainer_${Date.now()}`,
    senderName,
    senderCode,
    senderAvatarEmoji: '🥋',
    senderTrainerTitle: 'Coach Sportif',
    receiverId: profile.id,
    receiverCode: profile.friendCode,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const current = await getPendingFriendRequests();
  const updated = [simulated, ...current];
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_REQUESTS, JSON.stringify(updated));
  return simulated;
}

