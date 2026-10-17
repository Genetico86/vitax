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
    trainerTitle: profile.trainerTitle,
    avatarPokemonEmoji: profile.avatarPokemonEmoji,
    avatarUrl: profile.avatarUrl,
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
              avatarUrl: f.avatarUrl || stat?.avatar_url,
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

    if (friendEntries.length === 0 && friends.length > 0) {
      for (const f of friends) {
        friendEntries.push({
          userId: f.friendId,
          username: f.username,
          trainerTitle: f.trainerTitle,
          avatarPokemonEmoji: f.avatarPokemonEmoji,
          avatarUrl: f.avatarUrl,
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
          // Récupérer également les photos de profil depuis la table profiles
          const competitorIds = data.map((d: any) => d.user_id);
          const { data: profilesMap } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', competitorIds);

          const avatarByUserId = new Map<string, string>();
          if (profilesMap) {
            for (const p of profilesMap) {
              if (p.avatar_url) avatarByUserId.set(p.id, p.avatar_url);
            }
          }

          for (const d of data) {
            const avatarUrl = d.avatar_url || avatarByUserId.get(d.user_id);
            realLeaderboardEntries.push({
              userId: d.user_id,
              username: d.username,
              trainerTitle: d.trainer_title || 'Athlète',
              avatarPokemonEmoji: d.avatar_pokemon_emoji || '⚡',
              avatarUrl,
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
