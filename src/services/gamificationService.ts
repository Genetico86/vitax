import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../database/db';
import { WorkoutSession } from '../types';
import { STORAGE_KEY_PROFILE } from './authService';
import { computeSetXp, STORAGE_KEY_DAILY_BONUS } from './exerciseWeightingService';

export interface AthleteRankTier {
  level: number;
  badgeName: string;
  category: string;
  specialty: string;
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
  category: string;
  specialty: string;
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
}

export interface SessionXpSummary {
  completionXp: number;
  setsXp: number;
  volumeXp: number;
  totalXp: number;
}

/**
 * Paliers de progression sportive basés sur l'expérience d'entraînement (XP)
 */
export const ATHLETE_RANK_TIERS: AthleteRankTier[] = [
  {
    level: 1,
    badgeName: 'Athlète Novice',
    category: 'Fondations',
    specialty: 'Initiation Force',
    emoji: '🏋️',
    minXp: 0,
    nextXp: 500,
    description: 'Le premier grade officiel. Récompense les fondations de la force et vos débuts.',
  },
  {
    level: 2,
    badgeName: 'Athlète Régulier',
    category: 'Constance',
    specialty: 'Discipline & Rythme',
    emoji: '🔥',
    minXp: 500,
    nextXp: 1200,
    description: 'Fluidité d’exécution et constance : l’entraînement devient une habitude solide.',
  },
  {
    level: 3,
    badgeName: 'Athlète Explosif',
    category: 'Puissance',
    specialty: 'Surcharge Progressive',
    emoji: '⚡',
    minXp: 1200,
    nextXp: 2200,
    description: 'Explosivité sur chaque répétition et surcharges progressives validées.',
  },
  {
    level: 4,
    badgeName: 'Athlète Complet',
    category: 'Équilibre',
    specialty: 'Symétrie Musculaire',
    emoji: '💪',
    minXp: 2200,
    nextXp: 3500,
    description: 'Développement complet et équilibré de tous les groupes musculaires.',
  },
  {
    level: 5,
    badgeName: 'Athlète Endurant',
    category: 'Résistance',
    specialty: 'Haute Intensité',
    emoji: '🛡️',
    minXp: 3500,
    nextXp: 5200,
    description: 'Résistance à l’effort intense et discipline mentale à toute épreuve.',
  },
  {
    level: 6,
    badgeName: 'Athlète Expert',
    category: 'Maîtrise',
    specialty: 'Connexion Muscle-Esprit',
    emoji: '🎯',
    minXp: 5200,
    nextXp: 7500,
    description: 'Connexion esprit-muscle totale : contrôle précis de chaque répétition.',
  },
  {
    level: 7,
    badgeName: 'Athlète Élite',
    category: 'Performance',
    specialty: 'Force Pure',
    emoji: '🏆',
    minXp: 7500,
    nextXp: 10500,
    description: 'Intensité maximale à chaque séance et maîtrise avancée des charges lourdes.',
  },
  {
    level: 8,
    badgeName: 'Titan de la Fonte',
    category: 'Haute Performance',
    specialty: 'Domination Physique',
    emoji: '🔱',
    minXp: 10500,
    nextXp: 14500,
    description: 'Volume et régularité d’exception : vous faites partie de l’élite sportive.',
  },
  {
    level: 9,
    badgeName: 'Légende Vitax',
    category: 'Sommet Athlétique',
    specialty: 'Rang Suprême',
    emoji: '👑',
    minXp: 14500,
    nextXp: 20000,
    description: 'Le sommet absolu. Vous régnez en maître incontesté de la performance sportive !',
  },
];

/**
 * Calcule l'XP gagné sur une séance spécifique (source unique de vérité biomécanique)
 */
export function calculateSessionXp(
  session: WorkoutSession,
  sets?: {
    weight: number;
    reps: number;
    completed?: number | boolean;
    exercise_name?: string;
    target_muscle?: string;
    equipment_needed?: string;
  }[]
): SessionXpSummary {
  const completionXp = 0;
  let setsXp = 0;
  let volumeXp = 0;

  if (sets && sets.length > 0) {
    sets.forEach((s) => {
      const isDone = s.completed === undefined ? true : Boolean(s.completed);
      if (isDone && (s.weight > 0 || s.reps > 0)) {
        const comp = computeSetXp({
          exerciseName: s.exercise_name,
          targetMuscle: s.target_muscle,
          equipmentNeeded: s.equipment_needed,
          weight: s.weight || 0,
          reps: s.reps || 0,
        });
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
 * Calcule l'XP biomécanique d'un seul exercice actif (pour la bannière de validation en direct)
 */
export function calculateSingleExerciseXp(exerciseItem: {
  exercise: { name?: string; target_muscle?: string; equipment_needed?: string };
  sets: { weight: number; reps: number; completed?: boolean | number }[];
}): number {
  let xp = 0;
  exerciseItem.sets.forEach((s) => {
    if (s.completed && (s.weight > 0 || s.reps > 0)) {
      const comp = computeSetXp({
        exerciseName: exerciseItem.exercise.name,
        targetMuscle: exerciseItem.exercise.target_muscle,
        equipmentNeeded: exerciseItem.exercise.equipment_needed,
        weight: s.weight || 0,
        reps: s.reps || 0,
      });
      xp += comp.totalSetXp;
    }
  });
  return xp;
}

/**
 * Calcule l'XP biomécanique en direct pour l'ensemble des exercices d'une séance active
 */
export function calculateActiveExercisesXp(
  exercises: {
    exercise: { name?: string; target_muscle?: string; equipment_needed?: string };
    sets: { weight: number; reps: number; completed?: boolean | number }[];
  }[]
): {
  completedSets: number;
  volume: number;
  setsXp: number;
  volumeXp: number;
  inProgressXp: number;
  totalXp: number;
} {
  let completedSets = 0;
  let volume = 0;
  let setsXp = 0;
  let volumeXp = 0;

  exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      if (s.completed) {
        completedSets += 1;
        volume += (s.weight || 0) * (s.reps || 0);
        if ((s.weight || 0) > 0 || (s.reps || 0) > 0) {
          const comp = computeSetXp({
            exerciseName: ex.exercise.name,
            targetMuscle: ex.exercise.target_muscle,
            equipmentNeeded: ex.exercise.equipment_needed,
            weight: s.weight || 0,
            reps: s.reps || 0,
          });
          setsXp += comp.baseSetXp;
          volumeXp += comp.volumeXp;
        }
      }
    });
  });

  const inProgressXp = setsXp + volumeXp;
  return {
    completedSets,
    volume,
    setsXp,
    volumeXp,
    inProgressXp,
    totalXp: inProgressXp,
  };
}

/**
 * Calcule l'XP d'une session de course à pied ou de marche
 */
export function calculateRunningSessionXp(
  distanceKm: number,
  durationSeconds: number,
  isWalking = false
): number {
  const safeDist = Math.max(0, Number(distanceKm) || 0);
  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  if (safeDist <= 0 && safeDuration <= 0) return 0;

  if (isWalking) {
    // Marche : 35 XP base + 45 XP / km + 1.5 XP / min
    const base = 35;
    const kmXp = Math.round(safeDist * 45);
    const timeXp = Math.floor(safeDuration / 60) * 1.5;
    return Math.max(25, Math.round(base + kmXp + timeXp));
  }

  // Course : 50 XP base + 75 XP / km + 2 XP / min
  const base = 50;
  const kmXp = Math.round(safeDist * 75);
  const timeXp = Math.floor(safeDuration / 60) * 2;
  return Math.max(35, Math.round(base + kmXp + timeXp));
}

/**
 * Calcule dynamiquement le niveau, le grade et le pourcentage de progression pour un XP donné
 */
export function computeLevelInfoForXp(xp: number): LevelInfo {
  let currentTierIndex = 0;
  for (let i = ATHLETE_RANK_TIERS.length - 1; i >= 0; i--) {
    if (xp >= ATHLETE_RANK_TIERS[i].minXp) {
      currentTierIndex = i;
      break;
    }
  }

  const currentTier = ATHLETE_RANK_TIERS[currentTierIndex];
  const nextTier =
    currentTierIndex < ATHLETE_RANK_TIERS.length - 1
      ? ATHLETE_RANK_TIERS[currentTierIndex + 1]
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
    category: currentTier.category,
    specialty: currentTier.specialty,
    currentXp: xp,
    minXp: currentTier.minXp,
    nextLevelXp: currentTier.nextXp,
    nextBadgeTitle: nextTier ? nextTier.badgeName : 'Rang Suprême',
    nextBadgeEmoji: nextTier ? nextTier.emoji : '👑',
    progressPercent,
  };
}

let cachedSetsXpKey = '';
let cachedSetsBiomechanicalXp = 0;

/**
 * Récupère le total d'XP de l'utilisateur et calcule son niveau d'Athlète et ses trophées
 */
export async function getUserGamificationStats(): Promise<{
  totalXp: number;
  levelInfo: LevelInfo;
  allTiers: AthleteRankTier[];
  achievements: Achievement[];
  totalSessions: number;
  totalVolumeKg: number;
}> {
  const db = await getDatabase();

  const sessions = await db.getAllAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
  );

  const totalSetsRow = await db.getFirstAsync<{ setsCount: number }>(
    "SELECT COUNT(id) as setsCount FROM workout_sets WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
  );
  const totalSetsCount = totalSetsRow?.setsCount || 0;

  let totalVolumeKg = 0;
  sessions.forEach((s) => {
    totalVolumeKg += s.total_volume || 0;
  });

  const xpCacheKey = `${sessions.length}:${totalSetsCount}:${Math.round(totalVolumeKg)}`;
  let setsBiomechanicalXp = 0;
  let allCompletedSetsCount = totalSetsCount;

  if (xpCacheKey === cachedSetsXpKey && totalSetsCount > 0) {
    setsBiomechanicalXp = cachedSetsBiomechanicalXp;
  } else {
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
        WHERE (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR completed IS NULL)
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
      cachedSetsXpKey = xpCacheKey;
      cachedSetsBiomechanicalXp = setsBiomechanicalXp;
    } catch (setsErr) {
      console.warn('Erreur calcul setsBiomechanicalXp:', setsErr);
    }
  }

  let totalXp = 0;

  let sessionsFallbackXp = 0;
  sessions.forEach((s) => {
    const summary = calculateSessionXp(s);
    sessionsFallbackXp += summary.totalXp;
  });

  totalXp = Math.max(setsBiomechanicalXp, sessionsFallbackXp);

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

  // Prise en compte de la course à pied et de la marche dans l'XP
  let runningSessionsCount = 0;
  try {
    let runningSessions: { distance_km: number; duration_seconds: number; notes?: string | null }[] = [];
    try {
      runningSessions = await db.getAllAsync<{ distance_km: number; duration_seconds: number; notes?: string }>(
        'SELECT distance_km, duration_seconds, notes FROM running_sessions'
      );
    } catch {}

    if (!runningSessions || runningSessions.length === 0) {
      const raw = await AsyncStorage.getItem('@vitax_running_sessions_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) runningSessions = parsed;
      }
    }

    if (runningSessions && runningSessions.length > 0) {
      runningSessionsCount = runningSessions.length;
      runningSessions.forEach((r) => {
        const isWalk = Boolean(r.notes && r.notes.includes('[Marche]'));
        totalXp += calculateRunningSessionXp(r.distance_km, r.duration_seconds, isWalk);
      });
    }
  } catch (runErr) {
    console.warn('Erreur calcul running XP:', runErr);
  }

  // Lecture du nombre de séances synchronisées sur le profil Supabase
  let cloudWorkoutsCount = 0;
  let parsedProfile: any = null;
  try {
    const rawProfile = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
    if (rawProfile) {
      parsedProfile = JSON.parse(rawProfile);
      if (parsedProfile?.totalWorkouts && parsedProfile.totalWorkouts > 0) {
        cloudWorkoutsCount = parsedProfile.totalWorkouts;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture XP profil:', err);
  }

  // Calcul des trophées d'Athlète et crédit effectif de leurs récompenses (rewardXp)
  const totalSessions = Math.max(sessions.length + runningSessionsCount, cloudWorkoutsCount);
  const effectiveSetsCount = Math.max(totalSetsCount, allCompletedSetsCount);
  const hasRack900Session = sessions.some(
    (s) => s.program_name && s.program_name.includes('Rack 900')
  );

  const baseAchievements: Achievement[] = [
    {
      id: 'first_workout',
      title: 'Première Séance Validée',
      description: 'Terminer votre toute première séance d’entraînement avec détermination',
      icon: '🎯',
      unlocked: totalSessions >= 1,
      progress: Math.min(1, totalSessions),
      maxProgress: 1,
      rewardXp: 50,
    },
    {
      id: 'iron_regular',
      title: 'Athlète Assidu',
      description: 'Valider 5 séances d’entraînement complètes sans abandonner',
      icon: '🔥',
      unlocked: totalSessions >= 5,
      progress: Math.min(5, totalSessions),
      maxProgress: 5,
      rewardXp: 150,
    },
    {
      id: 'century_sets',
      title: 'Série de Fer (50 Séries)',
      description: 'Enchaîner 50 séries d’efforts validées à pleine puissance',
      icon: '💥',
      unlocked: effectiveSetsCount >= 50,
      progress: Math.min(50, effectiveSetsCount),
      maxProgress: 50,
      rewardXp: 200,
    },
    {
      id: 'ten_tonnes',
      title: 'Colosse d’Acier (10 Tonnes)',
      description: 'Déplacer plus de 10 000 kg de fonte cumulés au total',
      icon: '🏋️‍♂️',
      unlocked: totalVolumeKg >= 10000,
      progress: Math.min(10000, Math.round(totalVolumeKg)),
      maxProgress: 10000,
      rewardXp: 300,
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
    },
    {
      id: 'veteran_titan',
      title: 'Vétéran de la Salle',
      description: 'Atteindre le cap des 20 séances d’entraînement complétées',
      icon: '⚡',
      unlocked: totalSessions >= 20,
      progress: Math.min(20, totalSessions),
      maxProgress: 20,
      rewardXp: 500,
    },
  ];

  // Créditer les récompenses XP des trophées débloqués
  const baseAchievementsXp = baseAchievements
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.rewardXp, 0);

  totalXp += baseAchievementsXp;

  const isTitanUnlocked = totalXp >= 10500 || (parsedProfile?.totalXp || 0) >= 10500;
  if (isTitanUnlocked) {
    totalXp += 1000;
  }

  const achievements: Achievement[] = [
    ...baseAchievements,
    {
      id: 'kanto_master_tier',
      title: 'Titan de la Fonte (10 500 XP)',
      description: 'Atteindre le rang Titan de la Fonte en accumulant 10 500 XP',
      icon: '🏆',
      unlocked: isTitanUnlocked,
      progress: Math.min(10500, totalXp),
      maxProgress: 10500,
      rewardXp: 1000,
    },
  ];

  // Synchronisation bidirectionnelle anti-régression avec le profil
  try {
    if (parsedProfile) {
      let profileUpdated = false;
      if (parsedProfile.totalXp && parsedProfile.totalXp > totalXp) {
        totalXp = parsedProfile.totalXp;
      } else if (totalXp > (parsedProfile.totalXp || 0)) {
        parsedProfile.totalXp = totalXp;
        profileUpdated = true;
      }
      if (profileUpdated) {
        await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(parsedProfile));
        import('./multiplayer/profileService')
          .then(({ syncTrainerProfileToSupabase }) => {
            void syncTrainerProfileToSupabase(parsedProfile);
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Erreur synchronisation XP profil:', err);
  }

  const levelInfo = computeLevelInfoForXp(totalXp);

  return {
    totalXp,
    levelInfo,
    allTiers: ATHLETE_RANK_TIERS,
    achievements,
    totalSessions,
    totalVolumeKg: Math.round(totalVolumeKg),
  };
}

