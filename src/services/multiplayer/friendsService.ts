import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeagueTier, FriendEntry, FriendRequest } from '../../types/social';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile, syncTrainerProfileToSupabase } from './profileService';

export const STORAGE_KEY_FRIENDS = '@vitax_friends_list';
export const STORAGE_KEY_FRIEND_REQUESTS = '@vitax_friend_requests';

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
                avatarUrl: p.avatar_url,
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

  await syncTrainerProfileToSupabase(profile);

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
      avatarUrl: targetProfile.avatar_url,
      currentLeague: (targetProfile.current_league as LeagueTier) || 'pierre',
      totalXp: targetProfile.total_xp || 0,
      addedAt: new Date().toISOString(),
    };

    const updatedList = [
      newFriend,
      ...existingFriends.filter((f) => f.friendId !== newFriend.friendId),
    ];
    await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updatedList));

    // Enregistrement réciproque dans Supabase
    await supabase.from('friends').upsert({
      id: `${profile.id}_${targetProfile.id}`,
      user_id: profile.id,
      friend_id: targetProfile.id,
    });
    await supabase.from('friends').upsert({
      id: `${targetProfile.id}_${profile.id}`,
      user_id: targetProfile.id,
      friend_id: profile.id,
    });

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

/**
 * Récupère les demandes d'invitations d'amis reçues et en attente
 */
export async function getPendingFriendRequests(): Promise<FriendRequest[]> {
  const profile = await getOrCreateTrainerProfile();
  let pendingRequests: FriendRequest[] = [];

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIEND_REQUESTS);
    if (raw) {
      pendingRequests = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erreur lecture local friend requests:', err);
  }

  if (
    isSupabaseConfigured() &&
    profile.id &&
    !profile.id.startsWith('vtx_') &&
    !profile.id.startsWith('trainer_') &&
    profile.id !== 'default_trainer'
  ) {
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

          const cloudRequests: FriendRequest[] = data.map((d: any) => ({
            id: d.id,
            senderId: d.sender_id,
            senderName: d.sender_name || 'Athlète Vitax',
            senderCode: d.sender_code,
            senderAvatarEmoji: d.sender_avatar || '⚡',
            senderAvatarUrl: d.sender_avatar_url || senderAvatarMap.get(d.sender_id),
            senderTrainerTitle: d.sender_title || 'Athlète Vitax',
            receiverId: d.receiver_id,
            receiverCode: d.receiver_code,
            status: d.status || 'pending',
            createdAt: d.created_at,
          }));

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
      avatarUrl: req.senderAvatarUrl,
      currentLeague: 'pierre',
      totalXp: 0,
      addedAt: new Date().toISOString(),
    };

    const existingFriends = await getFriendsList();
    const updatedFriends = [
      newFriend,
      ...existingFriends.filter((f) => f.friendId !== newFriend.friendId),
    ];
    await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updatedFriends));

    const remainingRequests = requests.filter((r) => r.id !== requestId);
    await AsyncStorage.setItem(STORAGE_KEY_FRIEND_REQUESTS, JSON.stringify(remainingRequests));

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('friend_requests')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', requestId);

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
