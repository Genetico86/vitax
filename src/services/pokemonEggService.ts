import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import {
  EggRarity,
  PokemonEgg,
  PokemonSpecies,
  IncubatorSlot,
  EggHatchResult,
} from '../types';

// -------------------------------------------------------------
// POKÉDEX COMPLET DES ESPÈCES DE POKÉMON (KANTO)
// -------------------------------------------------------------
export const POKEMON_SPECIES: PokemonSpecies[] = [
  // 🟢 STARTERS & DÉBUTANTS (Oeufs 200 XP)
  {
    id: 'pikachu',
    name: 'Pikachu',
    pokedexNumber: 25,
    emoji: '⚡',
    type: 'Électrik',
    baseCp: 450,
    rarity: 'starter',
    description: 'Souris électrique et mascotte de Kanto, adore les séries intenses et les tempos rapides !',
    isLegendary: false,
  },
  {
    id: 'bulbizarre',
    name: 'Bulbizarre',
    pokedexNumber: 1,
    emoji: '🍃',
    type: 'Plante / Poison',
    baseCp: 420,
    rarity: 'starter',
    description: 'Graine d’athlète sur le dos qui puise son énergie dans chaque goutte de sueur.',
    isLegendary: false,
  },
  {
    id: 'salameche',
    name: 'Salamèche',
    pokedexNumber: 4,
    emoji: '🔥',
    type: 'Feu',
    baseCp: 430,
    rarity: 'starter',
    description: 'La flamme au bout de sa queue brûle au rythme de vos séries géantes et de vos efforts.',
    isLegendary: false,
  },
  {
    id: 'carapuce',
    name: 'Carapuce',
    pokedexNumber: 7,
    emoji: '💧',
    type: 'Eau',
    baseCp: 420,
    rarity: 'starter',
    description: 'Carapace ultra-solide capable d’encaisser n’importe quelle charge sous les barres.',
    isLegendary: false,
  },
  {
    id: 'evoli',
    name: 'Évoli',
    pokedexNumber: 133,
    emoji: '🦊',
    type: 'Normal',
    baseCp: 440,
    rarity: 'starter',
    description: 'Potentiel d’évolution infini, s’adapte avec souplesse à tous vos cycles d’entraînement.',
    isLegendary: false,
  },
  {
    id: 'roucool',
    name: 'Roucool',
    pokedexNumber: 16,
    emoji: '🕊️',
    type: 'Normal / Vol',
    baseCp: 380,
    rarity: 'starter',
    description: 'Agilité et vivacité parfaites pour optimiser les temps de repos entre deux exercices.',
    isLegendary: false,
  },

  // 🟠 ATHLÈTES DE FORCE (Oeufs 500 XP)
  {
    id: 'machoc',
    name: 'Machoc',
    pokedexNumber: 66,
    emoji: '🥋',
    type: 'Combat',
    baseCp: 890,
    rarity: 'athlete',
    description: 'Soulève des rochers pour s’échauffer et ne rate absolument jamais un leg day !',
    isLegendary: false,
  },
  {
    id: 'tygnon',
    name: 'Tygnon',
    pokedexNumber: 106,
    emoji: '🥊',
    type: 'Combat',
    baseCp: 950,
    rarity: 'athlete',
    description: 'Spécialiste de la frappe explosive, ses directs fendent l’air à vitesse supersonique.',
    isLegendary: false,
  },
  {
    id: 'kicklee',
    name: 'Kicklee',
    pokedexNumber: 107,
    emoji: '🦵',
    type: 'Combat',
    baseCp: 940,
    rarity: 'athlete',
    description: 'Jambes flexibles en acier trempé capables de détruire un mur en un seul coup de pied.',
    isLegendary: false,
  },
  {
    id: 'onix',
    name: 'Onix',
    pokedexNumber: 95,
    emoji: '🪨',
    type: 'Roche / Sol',
    baseCp: 920,
    rarity: 'athlete',
    description: 'Serpent colossal de roche brute, symbole d’une structure posturale inébranlable.',
    isLegendary: false,
  },
  {
    id: 'scarabrute',
    name: 'Scarabrute',
    pokedexNumber: 127,
    emoji: '🪲',
    type: 'Insecte',
    baseCp: 960,
    rarity: 'athlete',
    description: 'Pinces surpuissantes capables de soulever 100 fois son propre poids à la cage.',
    isLegendary: false,
  },

  // 🟣 CHAMPIONS D’ENDURANCE (Oeufs 1 000 XP)
  {
    id: 'ronflex',
    name: 'Ronflex',
    pokedexNumber: 143,
    emoji: '💤',
    type: 'Normal',
    baseCp: 1620,
    rarity: 'champion',
    description: 'Masse brute colossale, capable de bloquer une route et de soulever 10 tonnes sans trembler !',
    isLegendary: false,
  },
  {
    id: 'minidraco',
    name: 'Minidraco',
    pokedexNumber: 147,
    emoji: '🐉',
    type: 'Dragon',
    baseCp: 1560,
    rarity: 'champion',
    description: 'Génétique d’élite qui annonce un futur titan redoutable pour la Ligue.',
    isLegendary: false,
  },
  {
    id: 'lokhlass',
    name: 'Lokhlass',
    pokedexNumber: 131,
    emoji: '🌊',
    type: 'Eau / Glace',
    baseCp: 1530,
    rarity: 'champion',
    description: 'Endurance inépuisable naviguant à travers l’effort intense sans jamais faiblir.',
    isLegendary: false,
  },
  {
    id: 'ptera',
    name: 'Ptéra',
    pokedexNumber: 142,
    emoji: '🦅',
    type: 'Roche / Vol',
    baseCp: 1590,
    rarity: 'champion',
    description: 'Féroce titan préhistorique à l’explosivité et au mordant inégalés.',
    isLegendary: false,
  },
  {
    id: 'leviator',
    name: 'Léviator',
    pokedexNumber: 130,
    emoji: '🐉',
    type: 'Eau / Vol',
    baseCp: 1680,
    rarity: 'champion',
    description: 'Transformation spectaculaire récompensant des mois de persévérance acharnée.',
    isLegendary: false,
  },

  // ⭐ POKÉMON LÉGENDAIRES (Oeufs 2 500 - 3 000 XP) — DÉBLOQUÉS PAR DÉFIS SPÉCIFIQUES
  {
    id: 'electhor',
    name: 'Électhor',
    pokedexNumber: 145,
    emoji: '⚡',
    type: 'Électrik / Vol',
    baseCp: 2880,
    rarity: 'legendary',
    description: 'Oiseau légendaire de la foudre qui décharge son énergie sur la cage et les poulies haute/basse !',
    isLegendary: true,
    unlockedByChallenge: 'Champion du Rack 900',
  },
  {
    id: 'artikodin',
    name: 'Artikodin',
    pokedexNumber: 144,
    emoji: '❄️',
    type: 'Glace / Vol',
    baseCp: 2820,
    rarity: 'legendary',
    description: 'Oiseau légendaire du blizzard, gardien du sang-froid et de la force pure des 10 000 kg !',
    isLegendary: true,
    unlockedByChallenge: 'Force de Ronflex (10 Tonnes)',
  },
  {
    id: 'sulfura',
    name: 'Sulfura',
    pokedexNumber: 146,
    emoji: '🔥',
    type: 'Feu / Vol',
    baseCp: 2920,
    rarity: 'legendary',
    description: 'Oiseau légendaire du feu, consumant l’effort dans une brûlure musculaire absolue sur 50 séries !',
    isLegendary: true,
    unlockedByChallenge: 'Attaque Combo (50 Séries)',
  },
  {
    id: 'mewtwo',
    name: 'Mewtwo',
    pokedexNumber: 150,
    emoji: '🧬',
    type: 'Psy',
    baseCp: 3500,
    rarity: 'legendary',
    description: 'Création génétique suprême d’une puissance incommensurable, conquis avec les 8 Badges de Kanto !',
    isLegendary: true,
    unlockedByChallenge: 'Badge Terre (8 Badges Conquis)',
  },
  {
    id: 'mew',
    name: 'Mew',
    pokedexNumber: 151,
    emoji: '🌟',
    type: 'Psy',
    baseCp: 3200,
    rarity: 'legendary',
    description: 'Pokémon fabuleux d’origine contenant le code génétique de tous les plus grands champions.',
    isLegendary: true,
    unlockedByChallenge: 'Maître du Conseil 4 (20 Séances)',
  },
];

// Configuration des raretés d'œufs
export const EGG_RARITY_CONFIG: Record<
  EggRarity,
  { name: string; requiredXp: number; emoji: string; color: string; bg: string }
> = {
  starter: {
    name: 'Œuf Découverte',
    requiredXp: 200,
    emoji: '🟢',
    color: '#10B981',
    bg: '#10231B',
  },
  athlete: {
    name: 'Œuf Athlète',
    requiredXp: 500,
    emoji: '🟠',
    color: '#F97316',
    bg: '#251A13',
  },
  champion: {
    name: 'Œuf Champion',
    requiredXp: 1000,
    emoji: '🟣',
    color: '#A855F7',
    bg: '#22152D',
  },
  legendary: {
    name: 'Œuf Légendaire',
    requiredXp: 2500,
    emoji: '⭐',
    color: '#EAB308',
    bg: '#2B2310',
  },
};

// -------------------------------------------------------------
// DÉTERMINATION DES 4 ESPACES D'INCUBATION
// -------------------------------------------------------------
export function computeIncubatorSlots(
  totalXp: number,
  totalSessions: number,
  totalVolumeKg: number,
  eggs: PokemonEgg[],
  maxUnlockedSlot: number = 1
): IncubatorSlot[] {
  // Slot 1 : Incubateur Basique (Infini)
  const slot1Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 1) || null;
  const slot1: IncubatorSlot = {
    slot_number: 1,
    name: 'Incubateur Basique',
    emoji: '🟢',
    is_unlocked: true,
    unlock_condition: 'Débloqué par défaut dès le départ',
    egg: slot1Egg,
  };

  // Slot 2 : Super-Incubateur (Badge Cascade 500 XP ou 5 séances)
  // Débloqué si 500 XP, 5 séances, déjà débloqué précédemment ou si un œuf y est présent
  const slot2Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 2) || null;
  const slot2Unlocked = totalXp >= 500 || totalSessions >= 5 || maxUnlockedSlot >= 2 || Boolean(slot2Egg);
  const slot2: IncubatorSlot = {
    slot_number: 2,
    name: 'Super-Incubateur',
    emoji: '💧',
    is_unlocked: slot2Unlocked,
    unlock_condition: 'Badge Cascade (500 XP) ou 5 séances terminées',
    egg: slot2Egg,
  };

  // Slot 3 : Hyper-Incubateur (Badge Prisme 2200 XP ou 15 séances)
  const slot3Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 3) || null;
  const slot3Unlocked = totalXp >= 2200 || totalSessions >= 15 || maxUnlockedSlot >= 3 || Boolean(slot3Egg);
  const slot3: IncubatorSlot = {
    slot_number: 3,
    name: 'Hyper-Incubateur',
    emoji: '🌈',
    is_unlocked: slot3Unlocked,
    unlock_condition: 'Badge Prisme (2 200 XP) ou 15 séances terminées',
    egg: slot3Egg,
  };

  // Slot 4 : Incubateur Maître (Badge Terre 10500 XP ou 10 Tonnes)
  const slot4Egg = eggs.find((e) => e.status === 'incubating' && e.incubator_slot === 4) || null;
  const slot4Unlocked = totalXp >= 10500 || totalVolumeKg >= 10000 || maxUnlockedSlot >= 4 || Boolean(slot4Egg);
  const slot4: IncubatorSlot = {
    slot_number: 4,
    name: 'Incubateur Maître',
    emoji: '🌍',
    is_unlocked: slot4Unlocked,
    unlock_condition: 'Badge Terre (10 500 XP) ou 10 000 kg soulevés',
    egg: slot4Egg,
  };

  return [slot1, slot2, slot3, slot4];
}

// -------------------------------------------------------------
// GESTION EN BASE DE DONNÉES (SQLITE HORS-LIGNE)
// -------------------------------------------------------------

/**
 * Initialise l'œuf de bienvenue au premier démarrage si la base est vide
 */
export async function ensureStarterEggInitialized(): Promise<void> {
  const db = await getDatabase();
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(id) as count FROM pokemon_eggs'
  );

  if ((countRow?.count || 0) === 0) {
    const now = new Date().toISOString();
    // 1er œuf placé dans l'incubateur 1
    await db.runAsync(
      `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, is_legendary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        'egg_starter_welcome',
        'Œuf Découverte',
        'starter',
        200,
        0,
        'incubating',
        1,
        'Bienvenue sur Vitax !',
        now,
      ]
    );

    // 2e œuf de réserve dans l'inventaire
    await db.runAsync(
      `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, is_legendary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        'egg_athlete_gift',
        'Œuf Athlète',
        'athlete',
        500,
        0,
        'inventory',
        null,
        'Cadeau de Dresseur Débutant',
        now,
      ]
    );
  }
}

/**
 * Récupère tous les œufs enregistrés
 */
export async function getAllPokemonEggs(): Promise<PokemonEgg[]> {
  await ensureStarterEggInitialized();
  const db = await getDatabase();
  return await db.getAllAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs ORDER BY CASE status WHEN 'incubating' THEN 1 WHEN 'inventory' THEN 2 ELSE 3 END, obtained_at DESC"
  );
}

/**
 * Place un œuf dans un espace d'incubation libre
 */
export async function placeEggInSlot(eggId: string, slotNumber: number): Promise<boolean> {
  const db = await getDatabase();

  // Vérifier qu'aucun œuf différent n'est déjà dans ce slot
  const existingInSlot = await db.getFirstAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE incubator_slot = ? AND status = 'incubating' AND id != ?",
    [slotNumber, eggId]
  );
  if (existingInSlot) {
    return false;
  }

  await db.runAsync(
    "UPDATE pokemon_eggs SET status = 'incubating', incubator_slot = ? WHERE id = ?",
    [slotNumber, eggId]
  );

  // Mémoriser que cet incubateur est débloqué pour ne jamais le reverrouiller
  try {
    const rawMax = await AsyncStorage.getItem('@vitax_max_unlocked_incubator');
    const currMax = rawMax ? parseInt(rawMax, 10) : 1;
    if (slotNumber > currMax) {
      await AsyncStorage.setItem('@vitax_max_unlocked_incubator', String(slotNumber));
    }
  } catch {}

  // Synchronisation Cloud immédiate pour ne jamais perdre l'incubation à la reconnexion
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après placement d’œuf:', syncErr);
  }

  return true;
}

/**
 * Retire un œuf de l'incubateur pour le remettre dans l'inventaire
 */
export async function removeEggFromSlot(eggId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE pokemon_eggs SET status = 'inventory', incubator_slot = NULL WHERE id = ?",
    [eggId]
  );

  // Synchronisation Cloud immédiate
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après retrait d’œuf:', syncErr);
  }
}

/**
 * Ajoute un nouvel œuf à l'inventaire
 */
export async function addPokemonEgg(
  rarity: EggRarity,
  obtainedFrom: string,
  specificPokemonId?: string
): Promise<PokemonEgg> {
  const db = await getDatabase();
  const config = EGG_RARITY_CONFIG[rarity];
  const eggId = `egg_${rarity}_${Date.now()}`;
  const now = new Date().toISOString();
  const isLegendary = rarity === 'legendary' ? 1 : 0;

  let assignedPokemon: PokemonSpecies | undefined;
  if (specificPokemonId) {
    assignedPokemon = POKEMON_SPECIES.find((p) => p.id === specificPokemonId);
  }

  const eggName = assignedPokemon
    ? `Œuf de ${assignedPokemon.name}`
    : config.name;

  await db.runAsync(
    `INSERT INTO pokemon_eggs (id, name, rarity, required_xp, current_xp, status, incubator_slot, obtained_from, obtained_at, pokemon_id, pokemon_name, pokemon_emoji, pokemon_type, is_legendary)
     VALUES (?, ?, ?, ?, 0, 'inventory', NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eggId,
      eggName,
      rarity,
      config.requiredXp,
      obtainedFrom,
      now,
      assignedPokemon?.id || null,
      assignedPokemon?.name || null,
      assignedPokemon?.emoji || null,
      assignedPokemon?.type || null,
      isLegendary,
    ]
  );

  // Synchronisation Cloud du nouvel œuf
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après ajout œuf:', syncErr);
  }

  return {
    id: eggId,
    name: eggName,
    rarity,
    required_xp: config.requiredXp,
    current_xp: 0,
    status: 'inventory',
    incubator_slot: null,
    obtained_from: obtainedFrom,
    obtained_at: now,
    pokemon_id: assignedPokemon?.id || null,
    pokemon_name: assignedPokemon?.name || null,
    pokemon_emoji: assignedPokemon?.emoji || null,
    pokemon_type: assignedPokemon?.type || null,
    is_legendary: isLegendary,
  };
}

/**
 * Distribue l'XP d'entraînement à tous les œufs en cours d'incubation
 * et gère les éclosions immédiates
 */
export async function distributeWorkoutXpToIncubators(
  xpEarned: number
): Promise<{
  updatedEggs: PokemonEgg[];
  newlyHatched: EggHatchResult[];
}> {
  await ensureStarterEggInitialized();
  const db = await getDatabase();
  const incubatingEggs = await db.getAllAsync<PokemonEgg>(
    "SELECT * FROM pokemon_eggs WHERE status = 'incubating'"
  );

  const newlyHatched: EggHatchResult[] = [];
  const updatedEggs: PokemonEgg[] = [];

  for (const egg of incubatingEggs) {
    const newXp = egg.current_xp + xpEarned;
    const isReadyToHatch = newXp >= egg.required_xp;

    if (isReadyToHatch) {
      // Déterminer le Pokémon obtenu
      let chosenSpecies: PokemonSpecies | undefined;
      if (egg.pokemon_id) {
        chosenSpecies = POKEMON_SPECIES.find((p) => p.id === egg.pokemon_id);
      }

      if (!chosenSpecies) {
        // Tirage aléatoire parmi les Pokémon correspondant à cette rareté
        const candidates = POKEMON_SPECIES.filter(
          (p) => p.rarity === egg.rarity && !p.isLegendary
        );
        chosenSpecies =
          candidates[Math.floor(Math.random() * candidates.length)] ||
          POKEMON_SPECIES[0];
      }

      // Bonus CP aléatoire (+0 à +100 CP selon l'effort)
      const cpBonus = Math.floor(Math.random() * 80);
      const finalCp = chosenSpecies.baseCp + cpBonus;
      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE pokemon_eggs 
         SET status = 'hatched', 
             current_xp = ?, 
             incubator_slot = NULL, 
             hatched_at = ?,
             pokemon_id = ?,
             pokemon_name = ?,
             pokemon_emoji = ?,
             pokemon_type = ?,
             pokemon_cp = ?,
             is_legendary = ?
         WHERE id = ?`,
        [
          egg.required_xp,
          now,
          chosenSpecies.id,
          chosenSpecies.name,
          chosenSpecies.emoji,
          chosenSpecies.type,
          finalCp,
          chosenSpecies.isLegendary ? 1 : 0,
          egg.id,
        ]
      );

      const hatchedResult: EggHatchResult = {
        egg: {
          ...egg,
          current_xp: egg.required_xp,
          status: 'hatched',
          incubator_slot: null,
          hatched_at: now,
          pokemon_id: chosenSpecies.id,
          pokemon_name: chosenSpecies.name,
          pokemon_emoji: chosenSpecies.emoji,
          pokemon_type: chosenSpecies.type,
          pokemon_cp: finalCp,
          is_legendary: chosenSpecies.isLegendary ? 1 : 0,
        },
        pokemonName: chosenSpecies.name,
        pokemonEmoji: chosenSpecies.emoji,
        pokemonType: chosenSpecies.type,
        pokemonCp: finalCp,
        isLegendary: chosenSpecies.isLegendary,
        description: chosenSpecies.description,
      };

      newlyHatched.push(hatchedResult);
      updatedEggs.push(hatchedResult.egg);
    } else {
      // Simple progression de l'incubation
      await db.runAsync(
        'UPDATE pokemon_eggs SET current_xp = ? WHERE id = ?',
        [newXp, egg.id]
      );

      updatedEggs.push({
        ...egg,
        current_xp: newXp,
      });
    }
  }

  // Synchronisation Cloud immédiate de l'évolution des œufs et éclosions
  try {
    const { syncPokemonEggsToCloud } = await import('./cloudSyncService');
    await syncPokemonEggsToCloud();
  } catch (syncErr) {
    console.warn('Erreur synchro cloud après gain XP œufs:', syncErr);
  }

  return { updatedEggs, newlyHatched };
}

/**
 * Synchronise les défis légendaires et offre les œufs associés aux challenges remplis
 */
export async function syncLegendaryChallengeEggs(stats: {
  totalSessions: number;
  totalSetsCount: number;
  totalVolumeKg: number;
  totalXp: number;
  hasRack900Session: boolean;
}): Promise<PokemonEgg[]> {
  const db = await getDatabase();
  const existingEggs = await db.getAllAsync<PokemonEgg>('SELECT * FROM pokemon_eggs');
  const awardedEggs: PokemonEgg[] = [];

  const checkAndAward = async (
    challengeKey: string,
    pokemonId: string,
    obtainedReason: string,
    condition: boolean
  ) => {
    if (!condition) return;

    const alreadyHas = existingEggs.some(
      (e) => e.pokemon_id === pokemonId || (e.obtained_from && e.obtained_from.includes(challengeKey))
    );

    if (!alreadyHas) {
      const awarded = await addPokemonEgg('legendary', obtainedReason, pokemonId);
      awardedEggs.push(awarded);
    }
  };

  // 1. Défi Champion du Rack 900 ➔ Électhor ⚡
  await checkAndAward(
    'Rack 900',
    'electhor',
    'Défi Débloqué : Champion du Rack 900',
    stats.hasRack900Session
  );

  // 2. Défi Force de Ronflex (10 Tonnes) ➔ Artikodin ❄️
  await checkAndAward(
    '10 Tonnes',
    'artikodin',
    'Défi Débloqué : Force de Ronflex (10 Tonnes)',
    stats.totalVolumeKg >= 10000
  );

  // 3. Défi Attaque Combo (50 Séries) ➔ Sulfura 🔥
  await checkAndAward(
    '50 Séries',
    'sulfura',
    'Défi Débloqué : Attaque Combo (50 Séries)',
    stats.totalSetsCount >= 50
  );

  // 4. Défi Badge Terre / 8 Badges (10 500 XP) ➔ Mewtwo 🧬
  await checkAndAward(
    'Badge Terre',
    'mewtwo',
    'Défi Débloqué : Badge Terre (8 Badges de Kanto)',
    stats.totalXp >= 10500
  );

  // 5. Défi Maître du Conseil 4 (20 Séances) ➔ Mew 🌟
  await checkAndAward(
    'Conseil 4',
    'mew',
    'Défi Débloqué : Maître du Conseil 4 (20 Séances)',
    stats.totalSessions >= 20
  );

  // S'il n'y a plus aucun œuf en réserve (moins de 2 œufs non éclos), offrir un œuf de motivation
  const unhatchedCount = existingEggs.filter((e) => e.status !== 'hatched').length;
  if (unhatchedCount < 2 && stats.totalSessions >= 1) {
    const rarityToAward: EggRarity = stats.totalSessions >= 8 ? 'champion' : 'athlete';
    const egg = await addPokemonEgg(
      rarityToAward,
      `Récompense de constance (Séance #${stats.totalSessions})`
    );
    awardedEggs.push(egg);
  }

  return awardedEggs;
}
