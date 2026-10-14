import { getDatabase } from '../database/db';
import { WorkoutSession, IncubatorSlot, PokemonEgg } from '../types';
import {
  getAllPokemonEggs,
  computeIncubatorSlots,
  syncLegendaryChallengeEggs,
} from './pokemonEggService';

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
 */
export function calculateSessionXp(session: WorkoutSession): SessionXpSummary {
  const completionXp = 100; // Bonus séance finie
  const setsXp = (session.total_sets || 0) * 15; // 15 XP par série
  const volumeXp = Math.floor((session.total_volume || 0) / 40); // 1 XP tous les 40 kg

  return {
    completionXp,
    setsXp,
    volumeXp,
    totalXp: completionXp + setsXp + volumeXp,
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
    'SELECT * FROM workout_sessions WHERE completed = 1'
  );

  const totalSetsRow = await db.getFirstAsync<{ setsCount: number }>(
    'SELECT COUNT(id) as setsCount FROM workout_sets WHERE completed = 1'
  );
  const totalSetsCount = totalSetsRow?.setsCount || 0;

  // Calcul du total d'XP accumulé
  let totalXp = 0;
  let totalVolumeKg = 0;

  sessions.forEach((s) => {
    totalVolumeKg += s.total_volume || 0;
    const summary = calculateSessionXp(s);
    totalXp += summary.totalXp;
  });

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

  // Détermination du palier / Badge Pokémon
  let currentTierIndex = 0;
  for (let i = POKEMON_BADGE_TIERS.length - 1; i >= 0; i--) {
    if (totalXp >= POKEMON_BADGE_TIERS[i].minXp) {
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
  const currentInRange = totalXp - currentTier.minXp;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentInRange / range) * 100))
  );

  const levelInfo: LevelInfo = {
    level: currentTier.level,
    title: currentTier.badgeName,
    badgeName: currentTier.badgeName,
    badgeEmoji: currentTier.emoji,
    city: currentTier.city,
    champion: currentTier.champion,
    type: currentTier.type,
    currentXp: totalXp,
    minXp: currentTier.minXp,
    nextLevelXp: currentTier.nextXp,
    nextBadgeTitle: nextTier ? nextTier.badgeName : 'Maître Suprême',
    nextBadgeEmoji: nextTier ? nextTier.emoji : '👑',
    progressPercent,
  };

  // Calcul des trophées de Dresseur
  const totalSessions = sessions.length;
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
      unlocked: totalSetsCount >= 50,
      progress: Math.min(50, totalSetsCount),
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
  await syncLegendaryChallengeEggs({
    totalSessions,
    totalSetsCount,
    totalVolumeKg,
    totalXp,
    hasRack900Session,
  });

  const allEggs = await getAllPokemonEggs();
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
