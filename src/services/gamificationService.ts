import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import { WorkoutSession, IncubatorSlot, PokemonEgg } from '../types';
import { STORAGE_KEY_PROFILE } from './authService';
import {
  getAllPokemonEggs,
  computeIncubatorSlots,
  syncLegendaryChallengeEggs,
} from './pokemonEggService';
import { computeSetXp, STORAGE_KEY_DAILY_BONUS } from './exerciseWeightingService';

export interface PokemonBadgeTier {
  level: number;
  badgeName: string;
  city: string;
  champion: string;
  type: string;
  emoji: string;
  minXp: number;
  nextXp: number;
  description: string;
}

export interface LevelInfo {
  level: number;
  title: string;
  badgeName: string;
  badgeEmoji: string;
  city: string;
  champion: string;
  type: string;
  currentXp: number;
  minXp: number;
  nextLevelXp: number;
  nextBadgeTitle: string;
  nextBadgeEmoji: string;
  progressPercent: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
  rewardXp: number;
  legendaryReward?: {
    speciesId: string;
    name: string;
    emoji: string;
    type: string;
  };
}

export interface SessionXpSummary {
  completionXp: number;
  setsXp: number;
  volumeXp: number;
  totalXp: number;
}

/**
 * Paliers de progression basés sur les 8 Badges d'Arène Pokémon de Kanto + Maître de la Ligue
 */
export const POKEMON_BADGE_TIERS: PokemonBadgeTier[] = [
  {
    level: 1,
    badgeName: 'Badge Roche',
    city: 'Argenta',
    champion: 'Pierre',
    type: 'Type Roche',
    emoji: '🪨',
    minXp: 0,
    nextXp: 500,
    description: 'Le premier badge officiel. Récompense les fondations de la force brute et vos débuts.',
  },
  {
    level: 2,
    badgeName: 'Badge Cascade',
    city: 'Azuria',
    champion: 'Ondine',
    type: 'Type Eau',
    emoji: '💧',
    minXp: 500,
    nextXp: 1200,
    description: 'Fluidité d’exécution et constance : l’entraînement devient une habitude naturelle.',
  },
  {
    level: 3,
    badgeName: 'Badge Foudre',
    city: 'Carmin sur Mer',
    champion: 'Major Bob',
    type: 'Type Électrik',
    emoji: '⚡',
    minXp: 1200,
    nextXp: 2200,
    description: 'Explosivité sur chaque répétition et surcharges progressives validées.',
  },
  {
    level: 4,
    badgeName: 'Badge Prisme',
    city: 'Céladopole',
    champion: 'Erika',
    type: 'Type Plante',
    emoji: '🌈',
    minXp: 2200,
    nextXp: 3500,
    description: 'Développement complet et équilibré de tous les groupes musculaires.',
  },
  {
    level: 5,
    badgeName: 'Badge Âme',
    city: 'Parmanie',
    champion: 'Koga',
    type: 'Type Poison',
    emoji: '💜',
    minXp: 3500,
    nextXp: 5200,
    description: 'Résistance extrême à l’acide lactique et discipline mentale impénétrable.',
  },
  {
    level: 6,
    badgeName: 'Badge Marais',
    city: 'Safrania',
    champion: 'Morgane',
    type: 'Type Psy',
    emoji: '🔮',
    minXp: 5200,
    nextXp: 7500,
    description: 'Connexion esprit-muscle totale : contrôle chirurgical de chaque contraction.',
  },
  {
    level: 7,
    badgeName: 'Badge Volcan',
    city: 'Cramois’Île',
    champion: 'Auguste',
    type: 'Type Feu',
    emoji: '🔥',
    minXp: 7500,
    nextXp: 10500,
    description: 'Intensité brûlante à chaque séance, sans jamais faiblir face à la douleur.',
  },
  {
    level: 8,
    badgeName: 'Badge Terre',
    city: 'Jadielle',
    champion: 'Giovanni',
    type: 'Type Sol',
    emoji: '🌍',
    minXp: 10500,
    nextXp: 14500,
    description: 'Les 8 Badges de Kanto conquis ! Puissance tellurique d’un champion d’exception.',
  },
  {
    level: 9,
    badgeName: 'Maître de la Ligue Pokémon',
    city: 'Plateau Indigo',
    champion: 'Conseil 4 & Maître',
    type: 'Rang Légendaire',
    emoji: '👑',
    minXp: 14500,
    nextXp: 20000,
    description: 'Le sommet absolu. Vous régnez en maître incontesté de l’Arène et de la Fonte !',
  },
];

/**
 * Calcule l'XP gagné sur une séance spécifique
 * NOTE : Suppression du bonus forfaitaire par séance pour éviter le farm abusif.
 * L'XP provient du travail biomécanique réel des séries + du bonus journalier d'entraînement.
 */
export function calculateSessionXp(session: WorkoutSession, sets?: { weight: number; reps: number; completed?: number }[]): SessionXpSummary {
  const completionXp = 0; // 0 XP forfaitaire par session
  let setsXp = 0;
  let volumeXp = 0;

  if (sets && sets.length > 0) {
    sets.forEach((s) => {
      const isDone = s.completed === undefined ? true : Boolean(s.completed);
      if (isDone && (s.weight > 0 || s.reps > 0)) {
        const comp = computeSetXp({ weight: s.weight, reps: s.reps });
        setsXp += comp.baseSetXp;
        volumeXp += comp.volumeXp;
      }
    });
  } else {
    setsXp = (session.total_sets || 0) * 10;
    volumeXp = Math.floor((session.total_volume || 0) / 40);
  }

  return {
    completionXp,
    setsXp,
    volumeXp,
    totalXp: setsXp + volumeXp,
  };
}

/**
 * Calcule dynamiquement le niveau, le badge et le pourcentage de progression pour un XP donné
 */
export function computeLevelInfoForXp(xp: number): LevelInfo {
  let currentTierIndex = 0;
  for (let i = POKEMON_BADGE_TIERS.length - 1; i >= 0; i--) {
    if (xp >= POKEMON_BADGE_TIERS[i].minXp) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = POKEMON_BADGE_TIERS[currentTierIndex];
  const nextTier =
    currentTierIndex < POKEMON_BADGE_TIERS.length - 1
      ? POKEMON_BADGE_TIERS[currentTierIndex + 1]
      : null;

  const range = currentTier.nextXp - currentTier.minXp;
  const currentInRange = xp - currentTier.minXp;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentInRange / range) * 100))
  );

  return {
    level: currentTier.level,
    title: currentTier.badgeName,
    badgeName: currentTier.badgeName,
    badgeEmoji: currentTier.emoji,
    city: currentTier.city,
    champion: currentTier.champion,
    type: currentTier.type,
    currentXp: xp,
    minXp: currentTier.minXp,
    nextLevelXp: currentTier.nextXp,
    nextBadgeTitle: nextTier ? nextTier.badgeName : 'Maître Suprême',
    nextBadgeEmoji: nextTier ? nextTier.emoji : '👑',
    progressPercent,
  };
}

/**
 * Récupère le total d'XP de l'utilisateur et calcule son niveau de Badge Pokémon
 */
export async function getUserGamificationStats(): Promise<{
  totalXp: number;
  levelInfo: LevelInfo;
  allTiers: PokemonBadgeTier[];
  achievements: Achievement[];
  totalSessions: number;
  totalVolumeKg: number;
  incubatorSlots: IncubatorSlot[];
  allEggs: PokemonEgg[];
  hatchedPokemon: PokemonEgg[];
  incubatingEggs: PokemonEgg[];
  inventoryEggs: PokemonEgg[];
}> {
  const db = await getDatabase();

  const sessions = await db.getAllAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
  );

  const totalSetsRow = await db.getFirstAsync<{ setsCount: number }>(
    "SELECT COUNT(id) as setsCount FROM workout_sets WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
  );
  const totalSetsCount = totalSetsRow?.setsCount || 0;

  let setsBiomechanicalXp = 0;
  let allCompletedSetsCount = 0;

  try {
    const allCompletedSets = await db.getAllAsync<{
      weight: number;
      reps: number;
      exercise_name?: string;
      target_muscle?: string;
      equipment_needed?: string;
    }>(`
      SELECT
        ws.weight,
        ws.reps,
        e.name AS exercise_name,
        e.target_muscle,
        e.equipment_needed
      FROM workout_sets ws
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      WHERE (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
    `);

    allCompletedSetsCount = allCompletedSets.length;
    for (const s of allCompletedSets) {
      if (s.weight > 0 || s.reps > 0) {
        const comp = computeSetXp({
          exerciseName: s.exercise_name,
          targetMuscle: s.target_muscle,
          equipmentNeeded: s.equipment_needed,
          weight: s.weight,
          reps: s.reps,
        });
        setsBiomechanicalXp += comp.totalSetXp;
      }
    }
  } catch (setsErr) {
    console.warn('Erreur calcul setsBiomechanicalXp:', setsErr);
  }

  // Calcul du total d'XP accumulé
  let totalXp = 0;
  let totalVolumeKg = 0;

  sessions.forEach((s) => {
    totalVolumeKg += s.total_volume || 0;
  });

  if (setsBiomechanicalXp > 0) {
    totalXp = setsBiomechanicalXp;
  } else {
    // Repli si les séries individuelles ne sont pas encore liées
    sessions.forEach((s) => {
      const summary = calculateSessionXp(s);
      totalXp += summary.totalXp;
    });
  }

  // Prise en compte des bonus journaliers d'entraînement validés
  try {
    const rawBonus = await AsyncStorage.getItem(STORAGE_KEY_DAILY_BONUS);
    if (rawBonus) {
      const parsedBonus = JSON.parse(rawBonus);
      if (parsedBonus.totalBonusesEarned && parsedBonus.totalBonusesEarned > 0) {
        totalXp += parsedBonus.totalBonusesEarned;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture daily bonus stats:', err);
  }

  // Prise en compte de la course à pied dans l'XP
  try {
    const runningSessions = await db.getAllAsync<{ distance_km: number; duration_seconds: number }>(
      'SELECT distance_km, duration_seconds FROM running_sessions'
    );
    runningSessions?.forEach((r) => {
      const kmXp = Math.round((r.distance_km || 0) * 75);
      const timeXp = Math.floor((r.duration_seconds || 0) / 60) * 2;
      totalXp += kmXp + timeXp + 50;
    });
  } catch {
    // Table non encore migrée si ancien schéma
  }

  // Prise en compte de l'XP et des séances synchronisés sur le profil Supabase (au cas où l'historique complet n'est pas encore téléchargé)
  let cloudWorkoutsCount = 0;
  try {
    const rawProfile = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed.totalXp && parsed.totalXp > totalXp) {
        totalXp = parsed.totalXp;
      } else if (totalXp > (parsed.totalXp || 0)) {
        // Le stockage SQLite local a plus d'XP : mettre à jour le profil pour ne jamais perdre l'XP gagné
        parsed.totalXp = totalXp;
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(parsed));
      }
      if (parsed.totalWorkouts && parsed.totalWorkouts > 0) {
        cloudWorkoutsCount = parsed.totalWorkouts;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture XP profil:', err);
  }

  const levelInfo = computeLevelInfoForXp(totalXp);

  // Calcul des trophées de Dresseur
  const totalSessions = Math.max(sessions.length, cloudWorkoutsCount);
  const effectiveSetsCount = Math.max(totalSetsCount, allCompletedSetsCount);
  const hasRack900Session = sessions.some(
    (s) => s.program_name && s.program_name.includes('Rack 900')
  );

  const achievements: Achievement[] = [
    {
      id: 'first_workout',
      title: 'Premier Combat d’Arène',
      description: 'Terminer votre toute première séance d’entraînement avec bravoure',
      icon: '🔴',
      unlocked: totalSessions >= 1,
      progress: Math.min(1, totalSessions),
      maxProgress: 1,
      rewardXp: 50,
    },
    {
      id: 'iron_regular',
      title: 'Dresseur Assidu',
      description: 'Valider 5 séances d’entraînement complètes sans abandonner',
      icon: '🎒',
      unlocked: totalSessions >= 5,
      progress: Math.min(5, totalSessions),
      maxProgress: 5,
      rewardXp: 150,
    },
    {
      id: 'century_sets',
      title: 'Attaque Combo (50 Séries)',
      description: 'Enchaîner 50 séries d’efforts validées à pleine puissance',
      icon: '💥',
      unlocked: effectiveSetsCount >= 50,
      progress: Math.min(50, effectiveSetsCount),
      maxProgress: 50,
      rewardXp: 200,
      legendaryReward: {
        speciesId: 'sulfura',
        name: 'Sulfura',
        emoji: '🔥',
        type: 'Feu / Vol',
      },
    },
    {
      id: 'ten_tonnes',
      title: 'Force de Ronflex (10 Tonnes)',
      description: 'Déplacer plus de 10 000 kg de fonte cumulés au total',
      icon: '💤',
      unlocked: totalVolumeKg >= 10000,
      progress: Math.min(10000, Math.round(totalVolumeKg)),
      maxProgress: 10000,
      rewardXp: 300,
      legendaryReward: {
        speciesId: 'artikodin',
        name: 'Artikodin',
        emoji: '❄️',
        type: 'Glace / Vol',
      },
    },
    {
      id: 'rack_master',
      title: 'Champion du Rack 900',
      description: 'Compléter une séance sur la cage & poulies haute/basse',
      icon: '👑',
      unlocked: hasRack900Session,
      progress: hasRack900Session ? 1 : 0,
      maxProgress: 1,
      rewardXp: 150,
      legendaryReward: {
        speciesId: 'electhor',
        name: 'Électhor',
        emoji: '⚡',
        type: 'Électrik / Vol',
      },
    },
    {
      id: 'veteran_titan',
      title: 'Maître du Conseil 4',
      description: 'Atteindre le cap légendaire des 20 séances d’entraînement',
      icon: '⚡',
      unlocked: totalSessions >= 20,
      progress: Math.min(20, totalSessions),
      maxProgress: 20,
      rewardXp: 500,
      legendaryReward: {
        speciesId: 'mew',
        name: 'Mew',
        emoji: '🌟',
        type: 'Psy',
      },
    },
    {
      id: 'kanto_master_tier',
      title: 'Badge Terre (8 Badges)',
      description: 'Conquérir les 8 Badges de Kanto en atteignant 10 500 XP',
      icon: '🌍',
      unlocked: totalXp >= 10500,
      progress: Math.min(10500, totalXp),
      maxProgress: 10500,
      rewardXp: 1000,
      legendaryReward: {
        speciesId: 'mewtwo',
        name: 'Mewtwo',
        emoji: '🧬',
        type: 'Psy Suprême',
      },
    },
  ];

  // Synchronisation automatique des Oeufs de Pokémon (et défis légendaires)
  let allEggs: PokemonEgg[] = [];
  try {
    await syncLegendaryChallengeEggs({
      totalSessions,
      totalSetsCount,
      totalVolumeKg,
      totalXp,
      hasRack900Session,
    });
    allEggs = await getAllPokemonEggs();
  } catch (eggErr) {
    console.warn('Erreur chargement ou synchro oeufs Pokémon:', eggErr);
  }

  const incubatorSlots = computeIncubatorSlots(
    totalXp,
    totalSessions,
    totalVolumeKg,
    allEggs
  );

  const hatchedPokemon = allEggs.filter((e) => e.status === 'hatched');
  const incubatingEggs = allEggs.filter((e) => e.status === 'incubating');
  const inventoryEggs = allEggs.filter((e) => e.status === 'inventory');

  return {
    totalXp,
    levelInfo,
    allTiers: POKEMON_BADGE_TIERS,
    achievements,
    totalSessions,
    totalVolumeKg: Math.round(totalVolumeKg),
    incubatorSlots,
    allEggs,
    hatchedPokemon,
    incubatingEggs,
    inventoryEggs,
  };
}
