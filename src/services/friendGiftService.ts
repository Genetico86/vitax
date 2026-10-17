import AsyncStorage from '@react-native-async-storage/async-storage';
import { FriendGift } from '../types/social';
import { getOrCreateTrainerProfile } from './multiplayerService';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { sanitizePostgrestIdentifier } from '../utils/cryptoSecurity';

export const STORAGE_KEY_FRIEND_GIFTS = '@vitax_friend_gifts_v1';

/**
 * Crée et envoie un cadeau de motivation à un ami avec un objectif d'XP
 */
export async function createFriendGift(params: {
  receiverId: string;
  receiverName: string;
  receiverFriendCode: string;
  giftName: string;
  targetXpGain: number;
  personalMessage?: string;
}): Promise<FriendGift> {
  const profile = await getOrCreateTrainerProfile();
  const id = `gift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let receiverStartXp = 0;
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('total_xp')
          .eq('id', params.receiverId)
          .single();
        if (data && data.total_xp) {
          receiverStartXp = data.total_xp;
        }
      } catch {}
    }
  }

  const gift: FriendGift = {
    id,
    senderId: profile.id,
    senderName: profile.username || 'Athlète Vitax',
    senderAvatarEmoji: profile.avatarPokemonEmoji || '⚡',
    senderAvatarUrl: profile.avatarUrl,
    receiverId: params.receiverId,
    receiverName: params.receiverName,
    receiverFriendCode: params.receiverFriendCode,
    giftName: params.giftName.trim(),
    targetXpGain: Math.max(50, Math.round(params.targetXpGain)),
    startXp: receiverStartXp,
    currentProgressXp: 0,
    status: 'active',
    personalMessage: params.personalMessage?.trim(),
    createdAt: new Date().toISOString(),
  };

  // Sauvegarde locale
  const existing = await getAllLocalGifts();
  const updated = [gift, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_GIFTS, JSON.stringify(updated));

  // Sauvegarde Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('friend_gifts').upsert({
          id: gift.id,
          sender_id: gift.senderId,
          sender_name: gift.senderName,
          sender_avatar: gift.senderAvatarEmoji,
          receiver_id: gift.receiverId,
          receiver_name: gift.receiverName,
          receiver_code: gift.receiverFriendCode,
          gift_name: gift.giftName,
          target_xp_gain: gift.targetXpGain,
          start_xp: gift.startXp,
          current_progress_xp: 0,
          status: 'active',
          personal_message: gift.personalMessage,
          created_at: gift.createdAt,
        });
      } catch (err) {
        console.warn('Erreur envoi cadeau Supabase:', err);
      }
    }
  }

  return gift;
}

/**
 * Récupère tous les cadeaux locaux
 */
async function getAllLocalGifts(): Promise<FriendGift[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIEND_GIFTS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erreur lecture cadeaux locaux:', err);
  }
  return [];
}

/**
 * Récupère les cadeaux envoyés et reçus, avec mise à jour automatique de la progression d'XP
 */
export async function getFriendGifts(): Promise<{
  sent: FriendGift[];
  received: FriendGift[];
  unlockedUnclaimedCount: number;
}> {
  const profile = await getOrCreateTrainerProfile();
  let localGifts = await getAllLocalGifts();

  // Synchronisation Supabase si disponible
  const safeProfileId = sanitizePostgrestIdentifier(profile.id);
  const safeFriendCode = sanitizePostgrestIdentifier(profile.friendCode);
  if (isSupabaseConfigured() && (safeProfileId || safeFriendCode)) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const clauses: string[] = [];
        if (safeProfileId) {
          clauses.push(`receiver_id.eq.${safeProfileId}`);
          clauses.push(`sender_id.eq.${safeProfileId}`);
        }
        if (safeFriendCode) {
          clauses.push(`receiver_code.eq.${safeFriendCode}`);
        }

        const { data, error } = await supabase
          .from('friend_gifts')
          .select('*')
          .or(clauses.join(','))
          .order('created_at', { ascending: false });

        if (!error && data && Array.isArray(data)) {
          const senderIds = data.map((d: any) => d.sender_id);
          const { data: sendersProfiles } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', senderIds);

          const senderAvatarMap = new Map<string, string>();
          if (sendersProfiles) {
            for (const sp of sendersProfiles) {
              if (sp.avatar_url) senderAvatarMap.set(sp.id, sp.avatar_url);
            }
          }

          const cloudGifts: FriendGift[] = data.map((d: any) => ({
            id: d.id,
            senderId: d.sender_id,
            senderName: d.sender_name,
            senderAvatarEmoji: d.sender_avatar || '⚡',
            senderAvatarUrl: d.sender_avatar_url || senderAvatarMap.get(d.sender_id),
            receiverId: d.receiver_id,
            receiverName: d.receiver_name,
            receiverFriendCode: d.receiver_code,
            giftName: d.gift_name,
            targetXpGain: d.target_xp_gain,
            startXp: d.start_xp || 0,
            currentProgressXp: d.current_progress_xp || 0,
            status: d.status || 'active',
            personalMessage: d.personal_message,
            createdAt: d.created_at,
            unlockedAt: d.unlocked_at,
          }));

          const cloudIds = new Set(cloudGifts.map((g) => g.id));
          const uniqueLocal = localGifts.filter((g) => !cloudIds.has(g.id));
          localGifts = [...cloudGifts, ...uniqueLocal];
        }
      } catch (err) {
        console.warn('Erreur synchro cadeaux Supabase:', err);
      }
    }
  }

  // Évaluation de la progression pour les cadeaux que NOUS avons reçus
  let hasModifications = false;
  localGifts = localGifts.map((g) => {
    if (g.receiverId === profile.id || g.receiverFriendCode === profile.friendCode) {
      const xpGained = Math.max(0, profile.totalXp - (g.startXp || 0));
      const updatedProgress = Math.min(g.targetXpGain, xpGained);

      let newStatus = g.status;
      let unlockedAt = g.unlockedAt;

      if (xpGained >= g.targetXpGain && g.status === 'active') {
        newStatus = 'unlocked';
        unlockedAt = new Date().toISOString();
        hasModifications = true;
      }

      if (updatedProgress !== g.currentProgressXp || newStatus !== g.status) {
        hasModifications = true;
        return {
          ...g,
          currentProgressXp: updatedProgress,
          status: newStatus,
          unlockedAt,
        };
      }
    }
    return g;
  });

  if (hasModifications) {
    await AsyncStorage.setItem(STORAGE_KEY_FRIEND_GIFTS, JSON.stringify(localGifts));
  }

  const sent = localGifts.filter((g) => g.senderId === profile.id);
  const received = localGifts.filter(
    (g) => g.receiverId === profile.id || g.receiverFriendCode === profile.friendCode
  );

  const unlockedUnclaimedCount = received.filter((g) => g.status === 'unlocked').length;

  return { sent, received, unlockedUnclaimedCount };
}

/**
 * Marque un cadeau déverrouillé comme réclamé/célébré
 */
export async function claimFriendGift(giftId: string): Promise<boolean> {
  const gifts = await getAllLocalGifts();
  const idx = gifts.findIndex((g) => g.id === giftId);
  if (idx === -1) return false;

  gifts[idx].status = 'claimed';
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_GIFTS, JSON.stringify(gifts));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('friend_gifts')
          .update({ status: 'claimed' })
          .eq('id', giftId);
      } catch {}
    }
  }

  return true;
}

/**
 * Crée un cadeau de motivation simulé pour tester immédiatement le déverrouillage et la progression
 */
export async function simulateFriendGift(giftName: string = 'Shaker de Whey Isolate Chocolat', targetXp: number = 250): Promise<FriendGift> {
  const profile = await getOrCreateTrainerProfile();
  const simulated: FriendGift = {
    id: `gift_sim_${Date.now()}`,
    senderId: 'trainer_sim_coach',
    senderName: 'Sarah (Partenaire Arène)',
    senderAvatarEmoji: '🥊',
    receiverId: profile.id,
    receiverName: profile.username || 'Vous',
    receiverFriendCode: profile.friendCode,
    giftName,
    targetXpGain: targetXp,
    startXp: Math.max(0, profile.totalXp - 50), // Déjà entamé pour voir la barre bouger !
    currentProgressXp: 50,
    status: 'active',
    personalMessage: 'Donne tout sur tes prochaines séances, ce cadeau est pour toi ! ⚡',
    createdAt: new Date().toISOString(),
  };

  const existing = await getAllLocalGifts();
  const updated = [simulated, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY_FRIEND_GIFTS, JSON.stringify(updated));
  return simulated;
}
