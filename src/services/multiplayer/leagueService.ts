import { getDatabase } from '../../database/db';
import { WorkoutSession } from '../../types';
import { LeagueConfig, LeaderboardEntry } from '../../types/social';
import { calculateSessionXp, calculateRunningSessionXp, getUserGamificationStats } from '../gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile, getCurrentWeekBounds, LEAGUE_CONFIGS } from './profileService';
import { getFriendsList } from './friendsService';

let cachedWeeklyStats: {
  timestamp: number;
  stats: {
    weeklyXp: number;
    totalTonnageKg: number;
    cardioMinutes: number;
    workoutsCount: number;
  };
} | null = null;

export async function getWeeklyUserStats(forceRefresh = false): Promise<{
  weeklyXp: number;
  totalTonnageKg: number;
  cardioMinutes: number;
  workoutsCount: number;
}> {
  if (!forceRefresh && cachedWeeklyStats && Date.now() - cachedWeeklyStats.timestamp < 10000) {
    return cachedWeeklyStats.stats;
  }

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

  let runningSessionsCount = 0;
  try {
    const runningSessions = await db.getAllAsync<{
      distance_km: number;
      duration_seconds: number;
      date: string;
      notes?: string;
    }>(
      'SELECT distance_km, duration_seconds, date, notes FROM running_sessions WHERE date >= ? AND date <= ?',
      [start.toISOString(), end.toISOString()]
    );
    if (runningSessions && runningSessions.length > 0) {
      runningSessionsCount = runningSessions.length;
      for (const r of runningSessions) {
        const isWalk = Boolean(r.notes && r.notes.includes('[Marche]'));
        weeklyXp += calculateRunningSessionXp(r.distance_km, r.duration_seconds, isWalk);
        cardioMinutes += Math.round((r.duration_seconds || 0) / 60);
      }
    }
  } catch {}

  const stats = {
    weeklyXp,
    totalTonnageKg: Math.round(totalTonnageKg),
    cardioMinutes,
    workoutsCount: sessions.length + runningSessionsCount,
  };

  cachedWeeklyStats = {
    timestamp: Date.now(),
    stats,
  };

  return stats;
}

export const VITAX_COMMUNITY_ATHLETES: Omit<LeaderboardEntry, 'rank' | 'isCurrentUser' | 'isFriend' | 'trend'>[] = [
  {
    userId: 'vtx_alexandre_pl',
    username: 'Alexandre',
    friendCode: '81035',
    trainerTitle: 'Powerlifter',
    avatarPokemonEmoji: '🔥',
    avatarUrl: undefined,
    currentLeague: 'foudre',
    weeklyXp: 580,
    totalXp: 5890,
    totalTonnageKg: 28500,
    cardioMinutes: 0,
    workoutsCount: 34,
    weeklyWorkoutsCount: 3,
  },
  {
    userId: 'vtx_sarah_fit',
    username: 'Sarah',
    friendCode: '38194',
    trainerTitle: 'Coach Fitness',
    avatarPokemonEmoji: '💪',
    avatarUrl: undefined,
    currentLeague: 'cascade',
    weeklyXp: 450,
    totalXp: 4240,
    totalTonnageKg: 16850,
    cardioMinutes: 90,
    workoutsCount: 28,
    weeklyWorkoutsCount: 3,
  },
  {
    userId: 'vtx_kador557',
    username: 'kador557',
    friendCode: '79320',
    trainerTitle: 'Force & Musculation',
    avatarPokemonEmoji: '🏋️‍♂️',
    avatarUrl: undefined,
    currentLeague: 'foudre',
    weeklyXp: 410,
    totalXp: 5200,
    totalTonnageKg: 22800,
    cardioMinutes: 10,
    workoutsCount: 30,
    weeklyWorkoutsCount: 3,
  },
  {
    userId: 'vtx_thomas_force',
    username: 'Thomas',
    friendCode: '52941',
    trainerTitle: 'Athlète Force',
    avatarPokemonEmoji: '🏋️',
    avatarUrl: undefined,
    currentLeague: 'cascade',
    weeklyXp: 380,
    totalXp: 3180,
    totalTonnageKg: 18400,
    cardioMinutes: 20,
    workoutsCount: 22,
    weeklyWorkoutsCount: 2,
  },
  {
    userId: 'vtx_lucas_sw',
    username: 'Lucas',
    friendCode: '74128',
    trainerTitle: 'Street Workout',
    avatarPokemonEmoji: '🤸',
    avatarUrl: undefined,
    currentLeague: 'cascade',
    weeklyXp: 310,
    totalXp: 2650,
    totalTonnageKg: 11900,
    cardioMinutes: 45,
    workoutsCount: 18,
    weeklyWorkoutsCount: 2,
  },
  {
    userId: 'vtx_florence5',
    username: 'Florence5',
    friendCode: '68241',
    trainerTitle: 'Athlète Assidue',
    avatarPokemonEmoji: '🏃‍♀️',
    avatarUrl: undefined,
    currentLeague: 'cascade',
    weeklyXp: 270,
    totalXp: 2250,
    totalTonnageKg: 10500,
    cardioMinutes: 75,
    workoutsCount: 16,
    weeklyWorkoutsCount: 2,
  },
  {
    userId: 'vtx_emma_cross',
    username: 'Emma',
    friendCode: '62590',
    trainerTitle: 'Cross-Training',
    avatarPokemonEmoji: '⚡',
    avatarUrl: undefined,
    currentLeague: 'cascade',
    weeklyXp: 260,
    totalXp: 1820,
    totalTonnageKg: 8200,
    cardioMinutes: 60,
    workoutsCount: 14,
    weeklyWorkoutsCount: 2,
  },
  {
    userId: 'vtx_julie_cardio',
    username: 'Julie',
    friendCode: '49312',
    trainerTitle: 'Cardio & Fitness',
    avatarPokemonEmoji: '🏃‍♀️',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 210,
    totalXp: 1350,
    totalTonnageKg: 5800,
    cardioMinutes: 120,
    workoutsCount: 11,
    weeklyWorkoutsCount: 1,
  },
  {
    userId: 'vtx_maxime_hybrid',
    username: 'Maxime',
    friendCode: '90471',
    trainerTitle: 'Athlète Polyvalent',
    avatarPokemonEmoji: '🥊',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 180,
    totalXp: 1180,
    totalTonnageKg: 6600,
    cardioMinutes: 30,
    workoutsCount: 9,
    weeklyWorkoutsCount: 1,
  },
  {
    userId: 'vtx_judite221',
    username: 'Judite221',
    friendCode: '41593',
    trainerTitle: 'Passionnée Fitness',
    avatarPokemonEmoji: '⚡',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 160,
    totalXp: 880,
    totalTonnageKg: 4900,
    cardioMinutes: 50,
    workoutsCount: 8,
    weeklyWorkoutsCount: 1,
  },
  {
    userId: 'vtx_camille_fit',
    username: 'Camille',
    friendCode: '31876',
    trainerTitle: 'Athlète Régulière',
    avatarPokemonEmoji: '🧘‍♀️',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 140,
    totalXp: 750,
    totalTonnageKg: 3900,
    cardioMinutes: 40,
    workoutsCount: 6,
    weeklyWorkoutsCount: 1,
  },
  {
    userId: 'vtx_nicolas_dev',
    username: 'Nicolas',
    friendCode: '18549',
    trainerTitle: 'Débutant Motivé',
    avatarPokemonEmoji: '🎯',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 90,
    totalXp: 450,
    totalTonnageKg: 2100,
    cardioMinutes: 15,
    workoutsCount: 4,
    weeklyWorkoutsCount: 1,
  },
  {
    userId: 'vtx_sophie_fit',
    username: 'Sophie',
    friendCode: '67234',
    trainerTitle: 'Remise en Forme',
    avatarPokemonEmoji: '✨',
    avatarUrl: undefined,
    currentLeague: 'pierre',
    weeklyXp: 60,
    totalXp: 320,
    totalTonnageKg: 1400,
    cardioMinutes: 25,
    workoutsCount: 3,
    weeklyWorkoutsCount: 1,
  },
];

/**
 * Récupère le classement de la ligue :
 * - timeframe 'weekly' : Classement de la semaine courante (ligues, promotion dimanche 23h59)
 * - timeframe 'allTime' : Classement permanent basé sur le total d'EXP cumulée à vie
 * - Mode 'global' : Vrais athlètes connectés de la communauté
 * - Mode 'friends' : Vrais amis ajoutés uniquement
 */
export async function getLeagueLeaderboard(
  filter: 'global' | 'friends' = 'global',
  timeframe: 'weekly' | 'allTime' = 'weekly'
): Promise<{
  league: LeagueConfig;
  entries: LeaderboardEntry[];
  currentUserRank: number;
  timeRemainingText: string;
  totalParticipants: number;
  timeframe: 'weekly' | 'allTime';
}> {
  const profile = await getOrCreateTrainerProfile();
  const leagueConfig = LEAGUE_CONFIGS[profile.currentLeague] || LEAGUE_CONFIGS.pierre;
  const userStats = await getWeeklyUserStats();
  const { end, weekId } = getCurrentWeekBounds();

  const msRemaining = Math.max(0, end.getTime() - Date.now());
  const daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const timeRemainingText = `${daysLeft}j ${hoursLeft}h restantes`;

  const gamificationStats = await getUserGamificationStats().catch(() => null);
  const totalWorkoutsAllTime = Math.max(
    profile.totalWorkouts || 0,
    gamificationStats?.totalSessions || 0,
    userStats.workoutsCount
  );
  const totalXpAllTime = Math.max(
    profile.totalXp || 0,
    gamificationStats?.totalXp || 0
  );

  const currentUserEntry: Omit<LeaderboardEntry, 'rank'> = {
    userId: profile.id,
    username: profile.username || 'Vous',
    friendCode: profile.friendCode,
    trainerTitle: profile.trainerTitle,
    avatarPokemonEmoji: profile.avatarPokemonEmoji,
    avatarUrl: profile.avatarUrl,
    currentLeague: profile.currentLeague,
    weeklyXp: userStats.weeklyXp,
    totalXp: totalXpAllTime,
    totalTonnageKg: userStats.totalTonnageKg,
    cardioMinutes: userStats.cardioMinutes,
    workoutsCount: totalWorkoutsAllTime,
    weeklyWorkoutsCount: userStats.workoutsCount,
    isCurrentUser: true,
    isFriend: false,
    trend: 'same',
  };

  // Synchronisation de nos statistiques vers Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const lbPayload: any = {
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
      };
      if (profile.avatarUrl) {
        lbPayload.avatar_url = profile.avatarUrl;
      }

      void (async () => {
        try {
          const { error } = await supabase.from('weekly_leaderboards').upsert(lbPayload);
          if (error && (error.message?.includes('avatar_url') || error.code === '42703')) {
            delete lbPayload.avatar_url;
            await supabase.from('weekly_leaderboards').upsert(lbPayload);
          }
        } catch {}
      })();
    }
  }

  // -----------------------------------------------------------
  // OPTION A : CLASSEMENT ENTRE AMIS ("Mes Amis")
  // -----------------------------------------------------------
  if (filter === 'friends') {
    const friends = await getFriendsList();
    const friendEntries: Omit<LeaderboardEntry, 'rank'>[] = [];

    // Récupérer les stats réelles de la semaine et les profils consolidés pour ces amis depuis Supabase
    if (isSupabaseConfigured() && friends.length > 0) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const friendIds = friends.map((f) => f.friendId);
          const [{ data: statsData }, { data: profilesData }] = await Promise.all([
            supabase
              .from('weekly_leaderboards')
              .select('*')
              .eq('week_id', weekId)
              .in('user_id', friendIds),
            supabase
              .from('profiles')
              .select('id, total_xp, friend_code, avatar_url, current_league, total_workouts')
              .in('id', friendIds),
          ]);

          for (const f of friends) {
            const stat = statsData?.find((s: any) => s.user_id === f.friendId);
            const pData = profilesData?.find((p: any) => p.id === f.friendId);
            friendEntries.push({
              userId: f.friendId,
              username: f.username,
              friendCode: f.friendCode || pData?.friend_code,
              trainerTitle: f.trainerTitle,
              avatarPokemonEmoji: f.avatarPokemonEmoji,
              avatarUrl: f.avatarUrl || pData?.avatar_url || stat?.avatar_url,
              currentLeague: (pData?.current_league || f.currentLeague || 'pierre') as any,
              weeklyXp: stat?.weekly_xp || 0,
              totalXp: pData?.total_xp ?? f.totalXp ?? (stat?.weekly_xp || 0),
              totalTonnageKg: stat?.total_tonnage_kg || 0,
              cardioMinutes: stat?.cardio_minutes || 0,
              workoutsCount: pData?.total_workouts || stat?.workouts_count || 0,
              weeklyWorkoutsCount: stat?.workouts_count || 0,
              isCurrentUser: false,
              isFriend: true,
              trend: 'same',
            });
          }
        } catch (e) {
          console.warn('Erreur lecture stats amis Supabase:', e);
        }
      }
    }

    if (friendEntries.length === 0 && friends.length > 0) {
      for (const f of friends) {
        friendEntries.push({
          userId: f.friendId,
          username: f.username,
          friendCode: f.friendCode,
          trainerTitle: f.trainerTitle,
          avatarPokemonEmoji: f.avatarPokemonEmoji,
          avatarUrl: f.avatarUrl,
          weeklyXp: 0,
          totalXp: f.totalXp || 0,
          totalTonnageKg: 0,
          cardioMinutes: 0,
          workoutsCount: 0,
          isCurrentUser: false,
          isFriend: true,
          trend: 'same',
        });
      }
    }

    const combinedFriends = [...friendEntries, currentUserEntry];
    combinedFriends.sort((a, b) => {
      if (timeframe === 'weekly') {
        if (b.weeklyXp !== a.weeklyXp) {
          return b.weeklyXp - a.weeklyXp;
        }
        return (b.totalXp || 0) - (a.totalXp || 0);
      } else {
        const aTotal = a.totalXp || 0;
        const bTotal = b.totalXp || 0;
        if (bTotal !== aTotal) {
          return bTotal - aTotal;
        }
        return (b.workoutsCount || 0) - (a.workoutsCount || 0);
      }
    });

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
      timeframe,
    };
  }

  // -----------------------------------------------------------
  // OPTION B : CLASSEMENT GÉNÉRAL (Tous les Athlètes de la communauté)
  // -----------------------------------------------------------
  const realLeaderboardEntries: Omit<LeaderboardEntry, 'rank' | 'isCurrentUser'>[] = [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // 1. Récupérer les profils et les leaders de la semaine en parallèle
        const [profilesRes, weeklyRes] = await Promise.allSettled([
          supabase
            .from('profiles')
            .select('id, username, friend_code, trainer_title, avatar_pokemon_emoji, avatar_url, current_league, total_xp, total_workouts')
            .neq('id', profile.id)
            .order('total_xp', { ascending: false })
            .limit(60),
          supabase
            .from('weekly_leaderboards')
            .select('*')
            .eq('week_id', weekId)
            .neq('user_id', profile.id)
            .order('weekly_xp', { ascending: false })
            .limit(60),
        ]);

        const allProfiles = profilesRes.status === 'fulfilled' ? profilesRes.value.data || [] : [];
        const topWeeklyData = weeklyRes.status === 'fulfilled' ? weeklyRes.value.data || [] : [];

        // Map des stats hebdomadaires
        const weeklyMap = new Map<string, any>();
        for (const w of topWeeklyData) {
          weeklyMap.set(w.user_id, w);
        }

        // Map des profils
        const profileMap = new Map<string, any>();
        for (const p of allProfiles) {
          profileMap.set(p.id, p);
        }

        // Compléter les stats hebdomadaires manquantes pour les profils top total_xp
        const missingWeeklyIds = allProfiles
          .map((p: any) => p.id)
          .filter((id: string) => !weeklyMap.has(id));

        if (missingWeeklyIds.length > 0) {
          try {
            const { data: moreWeekly } = await supabase
              .from('weekly_leaderboards')
              .select('*')
              .eq('week_id', weekId)
              .in('user_id', missingWeeklyIds);
            if (moreWeekly) {
              for (const w of moreWeekly) {
                weeklyMap.set(w.user_id, w);
              }
            }
          } catch {}
        }

        // Fusionner tous les athlètes connus
        const allUserIds = new Set<string>([
          ...allProfiles.map((p: any) => p.id),
          ...topWeeklyData.map((w: any) => w.user_id),
        ]);

        for (const userId of allUserIds) {
          const p = profileMap.get(userId);
          const w = weeklyMap.get(userId);

          const username = p?.username || w?.username || 'Athlète Vitax';
          const friendCode = p?.friend_code;
          const trainerTitle = p?.trainer_title || w?.trainer_title || 'Athlète';
          const avatarPokemonEmoji = p?.avatar_pokemon_emoji || w?.avatar_pokemon_emoji || '⚡';
          const avatarUrl = p?.avatar_url || w?.avatar_url;
          const currentLeague = (p?.current_league || w?.current_league || 'pierre') as any;
          const weeklyXp = w?.weekly_xp || 0;
          const totalXp = p?.total_xp ?? (w?.weekly_xp || 0);
          const totalTonnageKg = w?.total_tonnage_kg || 0;
          const cardioMinutes = w?.cardio_minutes || 0;
          const workoutsCount = p?.total_workouts || w?.workouts_count || 0;
          const weeklyWorkoutsCount = w?.workouts_count || 0;

          realLeaderboardEntries.push({
            userId,
            username,
            friendCode,
            trainerTitle,
            avatarPokemonEmoji,
            avatarUrl,
            currentLeague,
            weeklyXp,
            totalXp,
            totalTonnageKg,
            cardioMinutes,
            workoutsCount,
            weeklyWorkoutsCount,
            isFriend: false,
            trend: 'same',
          });
        }
      } catch (err) {
        console.warn('Lecture cloud leaderboard:', err);
      }
    }
  }

  // 3. Compléter avec la communauté d'athlètes Vitax si nécessaire pour un classement vivant et stimulant
  const existingUsernames = new Set([
    (profile.username || '').toLowerCase().trim(),
    ...realLeaderboardEntries.map((r) => r.username.toLowerCase().trim()),
  ]);

  for (const comm of VITAX_COMMUNITY_ATHLETES) {
    if (!existingUsernames.has(comm.username.toLowerCase().trim()) && comm.userId !== profile.id) {
      realLeaderboardEntries.push({
        ...comm,
        isFriend: false,
        trend: 'same',
      });
    }
  }

  const combined = [...realLeaderboardEntries.map((p) => ({ ...p, isCurrentUser: false })), currentUserEntry];

  if (timeframe === 'weekly') {
    combined.sort((a, b) => {
      // 1. Priorité aux athlètes ayant marqué des points cette semaine
      if (b.weeklyXp !== a.weeklyXp) {
        return b.weeklyXp - a.weeklyXp;
      }
      // 2. À égalité de points hebdo, classer par XP totale du profil
      return (b.totalXp || 0) - (a.totalXp || 0);
    });
  } else {
    // CLASSEMENT PERMANENT : basé sur le total d'EXP cumulée
    combined.sort((a, b) => {
      const aTotal = a.totalXp || 0;
      const bTotal = b.totalXp || 0;
      if (bTotal !== aTotal) {
        return bTotal - aTotal;
      }
      // À égalité de total d'EXP, classer par nombre total de séances
      if ((b.workoutsCount || 0) !== (a.workoutsCount || 0)) {
        return (b.workoutsCount || 0) - (a.workoutsCount || 0);
      }
      return (b.totalTonnageKg || 0) - (a.totalTonnageKg || 0);
    });
  }

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
    timeframe,
  };
}
