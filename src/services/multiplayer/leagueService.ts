import { getDatabase } from '../../database/db';
import { WorkoutSession } from '../../types';
import { LeagueConfig, LeaderboardEntry } from '../../types/social';
import { calculateSessionXp } from '../gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile, getCurrentWeekBounds, LEAGUE_CONFIGS } from './profileService';
import { getFriendsList } from './friendsService';

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
    friendCode: profile.friendCode,
    trainerTitle: profile.trainerTitle,
    avatarPokemonEmoji: profile.avatarPokemonEmoji,
    avatarUrl: profile.avatarUrl,
    weeklyXp: userStats.weeklyXp,
    totalXp: profile.totalXp || 0,
    totalTonnageKg: userStats.totalTonnageKg,
    cardioMinutes: userStats.cardioMinutes,
    workoutsCount: userStats.workoutsCount,
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
              weeklyXp: stat?.weekly_xp || 0,
              totalXp: pData?.total_xp ?? f.totalXp ?? (stat?.weekly_xp || 0),
              totalTonnageKg: stat?.total_tonnage_kg || 0,
              cardioMinutes: stat?.cardio_minutes || 0,
              workoutsCount: stat?.workouts_count || pData?.total_workouts || 0,
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
      if (b.weeklyXp !== a.weeklyXp) {
        return b.weeklyXp - a.weeklyXp;
      }
      return (b.totalXp || 0) - (a.totalXp || 0);
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
        // 1. Récupérer TOUS les vrais profils d'athlètes enregistrés dans Supabase
        const { data: allProfiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, friend_code, trainer_title, avatar_pokemon_emoji, avatar_url, current_league, total_xp, total_workouts')
          .neq('id', profile.id)
          .order('total_xp', { ascending: false })
          .limit(50);

        if (!profErr && allProfiles && allProfiles.length > 0) {
          const competitorIds = allProfiles.map((p: any) => p.id);

          // 2. Récupérer les stats hebdomadaires correspondantes si existantes
          let weeklyMap = new Map<string, any>();
          try {
            const { data: weeklyData } = await supabase
              .from('weekly_leaderboards')
              .select('*')
              .eq('week_id', weekId)
              .in('user_id', competitorIds);

            if (weeklyData) {
              for (const w of weeklyData) {
                weeklyMap.set(w.user_id, w);
              }
            }
          } catch (wErr) {
            console.warn('Lecture stats hebdo concurrents:', wErr);
          }

          for (const p of allProfiles) {
            const w = weeklyMap.get(p.id);
            realLeaderboardEntries.push({
              userId: p.id,
              username: p.username || 'Athlète Vitax',
              friendCode: p.friend_code,
              trainerTitle: p.trainer_title || 'Athlète',
              avatarPokemonEmoji: p.avatar_pokemon_emoji || '⚡',
              avatarUrl: p.avatar_url,
              weeklyXp: w?.weekly_xp || 0,
              totalXp: p.total_xp || 0,
              totalTonnageKg: w?.total_tonnage_kg || 0,
              cardioMinutes: w?.cardio_minutes || 0,
              workoutsCount: w?.workouts_count || p.total_workouts || 0,
              isFriend: false,
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
  combined.sort((a, b) => {
    // 1. Priorité aux athlètes ayant marqué des points cette semaine
    if (b.weeklyXp !== a.weeklyXp) {
      return b.weeklyXp - a.weeklyXp;
    }
    // 2. À égalité de points hebdo, classer par XP totale du profil
    return (b.totalXp || 0) - (a.totalXp || 0);
  });

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
