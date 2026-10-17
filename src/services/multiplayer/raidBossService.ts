import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoOpRaidBoss, RaidParticipant, RaidMetric } from '../../types/social';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import {
  getOrCreateTrainerProfile,
  getCurrentWeekBounds,
  updateTrainerProfileXpAndStats,
} from './profileService';
import { getWeeklyUserStats } from './leagueService';

export const STORAGE_KEY_RAID_CLAIMED = '@vitax_raid_claimed_';

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
          const participantIds = data.map((d: any) => d.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', participantIds);
          const avatarMap = new Map<string, string>();
          if (profilesData) {
            for (const pr of profilesData) {
              if (pr.avatar_url) avatarMap.set(pr.id, pr.avatar_url);
            }
          }

          for (const d of data) {
            const val = d.contribution_value || 0;
            const pct = Math.round((val / targetValue) * 100);
            otherParticipants.push({
              userId: d.user_id,
              username: d.username,
              avatarPokemonEmoji: d.avatar_pokemon_emoji || '⚡',
              avatarUrl: avatarMap.get(d.user_id),
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
      avatarUrl: profile.avatarUrl,
      contributionValue: myContribution,
      percentage: myPercentage,
      isCurrentUser: true,
    },
    ...otherParticipants.map((m) => ({ ...m, isCurrentUser: false })),
  ];

  participants.sort((a, b) => b.contributionValue - a.contributionValue);
  const isVictory = currentProgress >= targetValue;

  return {
    id: `coop_challenge_${start.toISOString()}`,
    title: 'Défi Co-op de la Semaine',
    bossName: 'Défi 50 Tonnes d’Acier',
    bossEmoji: '🏋️‍♂️',
    bossType: 'Force Collective',
    description: 'Alliez-vous avec vos partenaires d’arène pour soulever collectivement 50 000 kg avant la fin du week-end !',
    targetMetric,
    targetMetricLabel: 'kg soulevés',
    targetValue,
    currentProgress,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: isVictory ? 'victory' : 'active',
    rewardXp: 500,
    rewardDescription: 'Bonus d’équipe : +500 XP de performance sportive',
    participants,
    hasClaimedReward: hasClaimed,
  };
}

export async function claimRaidVictoryReward(): Promise<{ rewardXp: number }> {
  const raid = await getActiveCoOpRaidBoss();
  if (raid.status !== 'victory') {
    throw new Error('L’objectif collectif n’a pas encore été atteint.');
  }

  const { start } = getCurrentWeekBounds();
  const storageKey = `${STORAGE_KEY_RAID_CLAIMED}_week_${start.toISOString()}`;

  await updateTrainerProfileXpAndStats(raid.rewardXp || 500);
  await AsyncStorage.setItem(storageKey, 'true');

  return { rewardXp: raid.rewardXp || 500 };
}
