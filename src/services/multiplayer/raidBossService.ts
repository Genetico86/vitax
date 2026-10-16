import AsyncStorage from '@react-native-async-storage/async-storage';
import { PokemonEgg } from '../../types';
import { CoOpRaidBoss, RaidParticipant, RaidMetric } from '../../types/social';
import { addPokemonEgg } from '../pokemonEggService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile, getCurrentWeekBounds } from './profileService';
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
