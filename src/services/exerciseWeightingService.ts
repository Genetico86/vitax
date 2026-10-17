import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY_DAILY_BONUS = '@vitax_daily_bonus_v1';
export const STORAGE_KEY_USER_BODYWEIGHT = '@vitax_user_bodyweight_cached';

export interface ExerciseBiomechanicalProfile {
  loadImportanceCoef: number; // Importance de la charge externe (ex: 0.85 à 1.45)
  bodyweightRatioCoef: number; // Incidence du poids du corps (ex: 1.00 à 1.45)
  muscleConstraintCoef: number; // Contrainte métabolique/systémique du muscle (ex: 0.90 à 1.40)
  difficultyCoef: number; // Coef agrégé
  bodyweightDisplacementRatio: number; // Pourcentage du poids de corps déplacé (0 à 0.95)
}

export interface SetXpComputation {
  baseSetXp: number;
  workVolumeKg: number;
  effectiveWeightKg: number;
  difficultyCoef: number;
  subCoefs: {
    loadImportance: number;
    bodyweightRatio: number;
    muscleConstraint: number;
  };
  volumeXp: number;
  totalSetXp: number;
}

export interface DailyBonusState {
  lastClaimDate: string; // YYYY-MM-DD
  currentStreak: number;
  totalBonusesEarned: number;
}

/**
 * Profils biomécaniques calibrés pour les mouvements fondamentaux
 */
const KNOWN_EXERCISE_PROFILES: Record<string, ExerciseBiomechanicalProfile> = {
  // Soulevé de terre : contrainte chaîne postérieure maximale, charge lourde
  deadlift: {
    loadImportanceCoef: 1.45,
    bodyweightRatioCoef: 1.15,
    muscleConstraintCoef: 1.40,
    difficultyCoef: 2.33,
    bodyweightDisplacementRatio: 0.40,
  },
  souleve_de_terre: {
    loadImportanceCoef: 1.45,
    bodyweightRatioCoef: 1.15,
    muscleConstraintCoef: 1.40,
    difficultyCoef: 2.33,
    bodyweightDisplacementRatio: 0.40,
  },
  // Squat barre : grand groupe quadriceps/fessiers, torse déplacé
  squat: {
    loadImportanceCoef: 1.40,
    bodyweightRatioCoef: 1.20,
    muscleConstraintCoef: 1.40,
    difficultyCoef: 2.35,
    bodyweightDisplacementRatio: 0.65,
  },
  // Tractions : 90% du poids du corps suspendu + grand dorsal
  tractions: {
    loadImportanceCoef: 1.20,
    bodyweightRatioCoef: 1.45,
    muscleConstraintCoef: 1.30,
    difficultyCoef: 2.26,
    bodyweightDisplacementRatio: 0.90,
  },
  pullup: {
    loadImportanceCoef: 1.20,
    bodyweightRatioCoef: 1.45,
    muscleConstraintCoef: 1.30,
    difficultyCoef: 2.26,
    bodyweightDisplacementRatio: 0.90,
  },
  // Dips : ~85% du poids de corps poussé verticalement
  dips: {
    loadImportanceCoef: 1.20,
    bodyweightRatioCoef: 1.35,
    muscleConstraintCoef: 1.15,
    difficultyCoef: 1.86,
    bodyweightDisplacementRatio: 0.85,
  },
  // Développé couché barre : pectoraux, charge lourde, zéro déplacement du corps
  bench_press: {
    loadImportanceCoef: 1.35,
    bodyweightRatioCoef: 1.00,
    muscleConstraintCoef: 1.20,
    difficultyCoef: 1.62,
    bodyweightDisplacementRatio: 0.0,
  },
  developpe_couche: {
    loadImportanceCoef: 1.35,
    bodyweightRatioCoef: 1.00,
    muscleConstraintCoef: 1.20,
    difficultyCoef: 1.62,
    bodyweightDisplacementRatio: 0.0,
  },
  // Rowing barre
  rowing: {
    loadImportanceCoef: 1.30,
    bodyweightRatioCoef: 1.05,
    muscleConstraintCoef: 1.30,
    difficultyCoef: 1.77,
    bodyweightDisplacementRatio: 0.15,
  },
  // Développé militaire
  military_press: {
    loadImportanceCoef: 1.25,
    bodyweightRatioCoef: 1.05,
    muscleConstraintCoef: 1.20,
    difficultyCoef: 1.58,
    bodyweightDisplacementRatio: 0.10,
  },
  developpe_militaire: {
    loadImportanceCoef: 1.25,
    bodyweightRatioCoef: 1.05,
    muscleConstraintCoef: 1.20,
    difficultyCoef: 1.58,
    bodyweightDisplacementRatio: 0.10,
  },
  // Pompes au sol : ~65% du poids du corps
  pompes: {
    loadImportanceCoef: 0.95,
    bodyweightRatioCoef: 1.25,
    muscleConstraintCoef: 1.10,
    difficultyCoef: 1.31,
    bodyweightDisplacementRatio: 0.65,
  },
  pushups: {
    loadImportanceCoef: 0.95,
    bodyweightRatioCoef: 1.25,
    muscleConstraintCoef: 1.10,
    difficultyCoef: 1.31,
    bodyweightDisplacementRatio: 0.65,
  },
  // Presse à cuisses : force guidée, fort tonnage mais levier assisté
  presse_cuisses: {
    loadImportanceCoef: 1.10,
    bodyweightRatioCoef: 1.00,
    muscleConstraintCoef: 1.35,
    difficultyCoef: 1.48,
    bodyweightDisplacementRatio: 0.0,
  },
  // Fentes : stabilité unilatérale + fessiers/quadriceps
  fentes: {
    loadImportanceCoef: 1.15,
    bodyweightRatioCoef: 1.20,
    muscleConstraintCoef: 1.35,
    difficultyCoef: 1.86,
    bodyweightDisplacementRatio: 0.70,
  },
  // Curls biceps
  curl: {
    loadImportanceCoef: 1.00,
    bodyweightRatioCoef: 1.00,
    muscleConstraintCoef: 1.00,
    difficultyCoef: 1.00,
    bodyweightDisplacementRatio: 0.0,
  },
  // Élévations latérales : bras de levier très long, faible charge nécessaire
  elevations_laterales: {
    loadImportanceCoef: 0.85,
    bodyweightRatioCoef: 1.00,
    muscleConstraintCoef: 0.95,
    difficultyCoef: 0.81,
    bodyweightDisplacementRatio: 0.0,
  },
};

/**
 * Détermine le profil biomécanique pour n'importe quel exercice
 */
export function getExerciseBiomechanicalProfile(
  exerciseName?: string,
  targetMuscle?: string,
  equipmentNeeded?: string
): ExerciseBiomechanicalProfile {
  const normName = (exerciseName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_');

  // 1. Recherche directe dans la table calibrée
  for (const [key, profile] of Object.entries(KNOWN_EXERCISE_PROFILES)) {
    if (normName.includes(key)) {
      return profile;
    }
  }

  // 2. Déduction intelligente basée sur le muscle et le matériel
  const muscle = (targetMuscle || '').toLowerCase();
  const equip = (equipmentNeeded || '').toLowerCase();

  // A. Sous-coef 1 : Contrainte musculaire
  let muscleConstraintCoef = 1.05;
  if (muscle.includes('jambe') || muscle.includes('quadriceps') || muscle.includes('fessier') || muscle.includes('dos')) {
    muscleConstraintCoef = 1.35; // Grand groupe / forte dépense
  } else if (muscle.includes('pect') || muscle.includes('epaule') || muscle.includes('épaule')) {
    muscleConstraintCoef = 1.18; // Moyen à grand groupe
  } else if (muscle.includes('bras') || muscle.includes('biceps') || muscle.includes('triceps') || muscle.includes('abdo')) {
    muscleConstraintCoef = 1.02; // Groupe moyen
  } else if (muscle.includes('mollet') || muscle.includes('avant-bras')) {
    muscleConstraintCoef = 0.92; // Petit groupe d'isolation
  }

  // B. Sous-coef 2 & 3 : Poids du corps et Importance de la charge
  let bodyweightRatioCoef = 1.00;
  let bodyweightDisplacementRatio = 0.0;
  let loadImportanceCoef = 1.00;

  if (equip.includes('traction') || normName.includes('traction')) {
    bodyweightRatioCoef = 1.45;
    bodyweightDisplacementRatio = 0.90;
    loadImportanceCoef = 1.20;
  } else if (equip.includes('parallele') || normName.includes('dips')) {
    bodyweightRatioCoef = 1.35;
    bodyweightDisplacementRatio = 0.85;
    loadImportanceCoef = 1.20;
  } else if (equip.includes('poids du corps') || equip.includes('sans materiel')) {
    bodyweightRatioCoef = 1.20;
    bodyweightDisplacementRatio = 0.65;
    loadImportanceCoef = 0.90;
  } else if (equip.includes('barre') || equip.includes('rack')) {
    bodyweightRatioCoef = 1.05;
    loadImportanceCoef = 1.38;
  } else if (equip.includes('haltere') || equip.includes('kettlebell')) {
    bodyweightRatioCoef = 1.00;
    loadImportanceCoef = 1.15;
  } else if (equip.includes('poulie') || equip.includes('machine')) {
    bodyweightRatioCoef = 1.00;
    loadImportanceCoef = 1.00;
  }

  const difficultyCoef = Number(
    (loadImportanceCoef * bodyweightRatioCoef * muscleConstraintCoef).toFixed(2)
  );

  return {
    loadImportanceCoef,
    bodyweightRatioCoef,
    muscleConstraintCoef,
    difficultyCoef,
    bodyweightDisplacementRatio,
  };
}

/**
 * Calcule l'XP d'une série validée selon la difficulté biomécanique
 */
export function computeSetXp(params: {
  exerciseName?: string;
  targetMuscle?: string;
  equipmentNeeded?: string;
  weight: number;
  reps: number;
  userBodyweightKg?: number;
}): SetXpComputation {
  const profile = getExerciseBiomechanicalProfile(
    params.exerciseName,
    params.targetMuscle,
    params.equipmentNeeded
  );

  const bodyweight = params.userBodyweightKg && params.userBodyweightKg > 30 ? params.userBodyweightKg : 75;
  const bwExtra = bodyweight * profile.bodyweightDisplacementRatio;
  const safeWeight = Math.min(Math.max(0, Number(params.weight) || 0), 500);
  const safeReps = Math.min(Math.max(1, Math.round(Number(params.reps) || 1)), 200);
  const effectiveWeightKg = Math.round((safeWeight + bwExtra) * 10) / 10;
  const workVolumeKg = Math.round(effectiveWeightKg * safeReps);

  // Base par série validée (effort d'exécution)
  const baseSetXp = 10;

  // XP volume pondéré par le coefficient de difficulté
  // Pour les exercices d'isolation légers (ex: élévations 10 kg), un facteur de compensation assure une récompense équitable
  let adjustedVolume = workVolumeKg;
  if (profile.difficultyCoef < 1.0 && safeWeight > 0 && safeWeight <= 20) {
    adjustedVolume = workVolumeKg * 1.6;
  }

  const volumeXp = Math.min(180, Math.max(1, Math.round((adjustedVolume * profile.difficultyCoef) / 45)));
  const totalSetXp = baseSetXp + volumeXp;

  return {
    baseSetXp,
    workVolumeKg,
    effectiveWeightKg,
    difficultyCoef: profile.difficultyCoef,
    subCoefs: {
      loadImportance: profile.loadImportanceCoef,
      bodyweightRatio: profile.bodyweightRatioCoef,
      muscleConstraint: profile.muscleConstraintCoef,
    },
    volumeXp,
    totalSetXp,
  };
}

/**
 * Vérifie le statut du bonus journalier
 */
export async function getDailyBonusStatus(): Promise<{
  isClaimedToday: boolean;
  currentStreak: number;
  todayDate: string;
}> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DAILY_BONUS);
    if (raw) {
      const state: DailyBonusState = JSON.parse(raw);
      return {
        isClaimedToday: state.lastClaimDate === today,
        currentStreak: state.currentStreak || 0,
        todayDate: today,
      };
    }
  } catch (err) {
    console.warn('Erreur lecture daily bonus:', err);
  }
  return {
    isClaimedToday: false,
    currentStreak: 0,
    todayDate: today,
  };
}

/**
 * Réclame le bonus journalier d'entraînement (+100 XP une seule fois par jour)
 */
export async function claimDailyWorkoutBonus(): Promise<{
  awarded: boolean;
  bonusXp: number;
  currentStreak: number;
  message: string;
}> {
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  try {
    let state: DailyBonusState = {
      lastClaimDate: '',
      currentStreak: 0,
      totalBonusesEarned: 0,
    };

    const raw = await AsyncStorage.getItem(STORAGE_KEY_DAILY_BONUS);
    if (raw) {
      state = JSON.parse(raw);
    }

    if (state.lastClaimDate === today) {
      return {
        awarded: false,
        bonusXp: 0,
        currentStreak: state.currentStreak,
        message: 'Bonus journalier déjà débloqué aujourd’hui !',
      };
    }

    // Calcul de la série de jours consécutifs (streak)
    const newStreak = state.lastClaimDate === yesterday ? (state.currentStreak || 0) + 1 : 1;
    const bonusXp = 100;

    const updatedState: DailyBonusState = {
      lastClaimDate: today,
      currentStreak: newStreak,
      totalBonusesEarned: (state.totalBonusesEarned || 0) + bonusXp,
    };

    await AsyncStorage.setItem(STORAGE_KEY_DAILY_BONUS, JSON.stringify(updatedState));

    return {
      awarded: true,
      bonusXp,
      currentStreak: newStreak,
      message: `🔥 Bonus Journalier débloqué (+100 XP) ! Série en cours : ${newStreak} jour${newStreak > 1 ? 's' : ''} consécutif${newStreak > 1 ? 's' : ''}.`,
    };
  } catch (err) {
    console.error('Erreur claimDailyWorkoutBonus:', err);
    return {
      awarded: false,
      bonusXp: 0,
      currentStreak: 0,
      message: 'Erreur bonus journalier.',
    };
  }
}
