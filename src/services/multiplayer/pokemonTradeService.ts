import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../../database/db';
import { PokemonEgg } from '../../types';
import { PokemonTradeOffer } from '../../types/social';
import { POKEMON_SPECIES } from '../pokemonEggService';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';
import { getOrCreateTrainerProfile } from './profileService';
import { getFriendsList } from './friendsService';

export const STORAGE_KEY_COMMUNITY_TRADES = '@vitax_community_trades';

export async function getTradablePokemon(): Promise<PokemonEgg[]> {
  const db = await getDatabase();
  const hatched = await db.getAllAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE status = 'hatched' ORDER BY hatched_at DESC"
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
    "SELECT * FROM pokemon_eggs WHERE id = ? AND status = 'hatched'",
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
    "SELECT * FROM pokemon_eggs WHERE id = ? AND status = 'hatched'",
    [myPokemonEggId]
  );

  if (!myEgg) {
    throw new Error('Votre Pokémon sélectionné est introuvable.');
  }

  // TRANSACTION SQLITE ATOMIQUE
  const { runInTransaction } = await import('../../database/db');
  const nowIso = new Date().toISOString();
  const newReceivedId = `traded_${Date.now()}_${offer.offeredPokemon.speciesId}`;
  const eggName = `Œuf de ${offer.offeredPokemon.name}`;

  await runInTransaction(db, async () => {
    await db.runAsync('DELETE FROM pokemon_eggs WHERE id = ?', [myPokemonEggId]);

    await db.runAsync(
      `INSERT INTO pokemon_eggs (
        id, name, rarity, required_xp, current_xp, status, incubator_slot,
        obtained_from, obtained_at, hatched_at, pokemon_id, pokemon_name, pokemon_emoji,
        pokemon_type, pokemon_cp, is_legendary, current_pokemon_xp
      ) VALUES (?, ?, ?, ?, ?, 'hatched', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        newReceivedId,
        eggName,
        offer.offeredPokemon.isLegendary ? 'legendary' : 'champion',
        500,
        500,
        `Échange avec ${offer.senderName} (${offer.senderCode})`,
        nowIso,
        nowIso,
        offer.offeredPokemon.speciesId,
        offer.offeredPokemon.name,
        offer.offeredPokemon.emoji,
        offer.offeredPokemon.type,
        offer.offeredPokemon.cp,
        offer.offeredPokemon.isLegendary ? 1 : 0,
      ]
    );
  });

  try {
    const { syncPokemonEggsToCloud } = await import('../cloudSyncService');
    void syncPokemonEggsToCloud();
  } catch {}

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
