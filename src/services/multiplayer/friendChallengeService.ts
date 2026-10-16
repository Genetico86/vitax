import AsyncStorage from '@react-native-async-storage/async-storage';
import { FriendChallenge } from '../../types/social';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile, updateTrainerProfileXpAndStats } from './profileService';

export const STORAGE_KEY_FRIEND_CHALLENGES = '@vitax_friend_challenges';

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
