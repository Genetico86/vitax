/**
 * Module d'Estimation Calorique Scientifique des Entraînements Vitax
 * Fondé sur le Compendium of Physical Activities (Ainsworth et al.),
 * le travail mécanique externe (tonnage soulevé), le déplacement du poids de corps
 * et la dépense post-effort EPOC (Excess Post-Exercise Oxygen Consumption).
 */

import { getExerciseBiomechanicalProfile } from '../services/exerciseWeightingService';

export interface ExerciseCalorieInput {
  exerciseId?: string;
  name: string;
  targetMuscle?: string;
  equipment?: string;
  sets: {
    weight?: number;
    reps?: number;
    completed: boolean;
  }[];
}

export interface WorkoutCalorieResult {
  totalCalories: number;
  activeCalories: number;
  epocCalories: number;
  averageMet: number;
  intensityCategory: 'light' | 'moderate' | 'intense' | 'very_intense';
  intensityLabel: string;
  breakdown: {
    exerciseName: string;
    calories: number;
    completedSets: number;
    volumeKg: number;
  }[];
}

/**
 * Poids de référence par défaut si l'athlète n'a pas encore renseigné de pesée
 */
export const DEFAULT_ATHLETE_WEIGHT_KG = 75;

/**
 * Calibre le MET moyen en série active selon la nature biomécanique du mouvement
 */
export function getExerciseActiveMet(
  exerciseName?: string,
  targetMuscle?: string,
  equipmentNeeded?: string
): number {
  const norm = (exerciseName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const muscle = (targetMuscle || '').toLowerCase();
  const equip = (equipmentNeeded || '').toLowerCase();

  // 1. Mouvements Cardio et Conditionnement métabolique intense
  if (
    norm.includes('burpee') ||
    norm.includes('corde a sauter') ||
    norm.includes('jump rope') ||
    norm.includes('mountain climber') ||
    norm.includes('rameur') ||
    norm.includes('rower') ||
    norm.includes('boxe') ||
    norm.includes('course') ||
    norm.includes('tapis') ||
    norm.includes('sprint') ||
    muscle.includes('cardio')
  ) {
    return 9.5;
  }

  // 2. Mouvements Polyarticulaires Lourds du Bas du Corps (Dépense métabolique systémique maximale)
  if (
    norm.includes('souleve de terre') ||
    norm.includes('deadlift') ||
    norm.includes('squat') ||
    norm.includes('fente') ||
    norm.includes('lunge') ||
    norm.includes('hip thrust') ||
    norm.includes('presse a cuisses') ||
    norm.includes('leg press') ||
    norm.includes('hack squat')
  ) {
    if (norm.includes('squat') || norm.includes('deadlift') || norm.includes('souleve')) {
      return 8.0; // Recrutement masse musculaire corporelle maximale
    }
    return 7.0;
  }

  // 3. Mouvements Polyarticulaires Haut du Corps (Dos, Pectoraux, Épaules lourdes)
  if (
    norm.includes('developpe couche') ||
    norm.includes('bench press') ||
    norm.includes('developpe militaire') ||
    norm.includes('military press') ||
    norm.includes('traction') ||
    norm.includes('pullup') ||
    norm.includes('chin-up') ||
    norm.includes('dips') ||
    norm.includes('rowing') ||
    norm.includes('barbell row') ||
    norm.includes('pompe') ||
    norm.includes('pushup')
  ) {
    return 6.5;
  }

  // 4. Mouvements sur machine guidée ou poulie pour grands groupes
  if (
    equip.includes('poulie') ||
    equip.includes('machine') ||
    muscle.includes('dos') ||
    muscle.includes('pect') ||
    muscle.includes('jambe')
  ) {
    return 5.2;
  }

  // 5. Mouvements pour abdominaux et gainage
  if (
    muscle.includes('abdo') ||
    norm.includes('gainage') ||
    norm.includes('plank') ||
    norm.includes('crunch') ||
    norm.includes('releve')
  ) {
    return 4.2;
  }

  // 6. Mouvements d'isolation des petits groupes (bras, mollets, deltoïdes latéraux)
  return 3.8;
}

/**
 * Calcule les calories brûlées pour un exercice donné
 */
export function calculateExerciseCalories(
  exercise: ExerciseCalorieInput,
  athleteWeightKg: number = DEFAULT_ATHLETE_WEIGHT_KG
): { calories: number; completedSets: number; volumeKg: number } {
  const profile = getExerciseBiomechanicalProfile(
    exercise.name,
    exercise.targetMuscle,
    exercise.equipment
  );
  const baseMet = getExerciseActiveMet(
    exercise.name,
    exercise.targetMuscle,
    exercise.equipment
  );

  const completedSets = exercise.sets.filter((s) => s.completed);
  if (completedSets.length === 0) {
    return { calories: 0, completedSets: 0, volumeKg: 0 };
  }

  let totalExerciseKcal = 0;
  let totalVolumeKg = 0;

  completedSets.forEach((set) => {
    const reps = Math.max(1, set.reps || 8);
    const weight = Math.max(0, set.weight || 0);
    const setVolume = weight * reps;
    totalVolumeKg += setVolume;

    // Durée estimée de la série active : ~3.5 secondes par répétition (phase excentrique + concentrique)
    const setDurationSeconds = reps * 3.5;
    const setDurationHours = setDurationSeconds / 3600;

    // Dépense métabolique de base pour cette série active (formule MET)
    // kcal = MET * poids(kg) * durée(h)
    const baseSetKcal = baseMet * athleteWeightKg * setDurationHours;

    // Dépense mécanique liée au tonnage externe soulevé :
    // Rendement mécanique du muscle humain : ~22% d'efficacité (le reste est dissipé en chaleur métabolique)
    // Travail W = masse * g * distance (~0.60m)
    const mechanicalJoules = setVolume * 9.81 * 0.60;
    const mechanicalKcal = (mechanicalJoules / 4184) / 0.22;

    // Dépense liée au déplacement du poids du corps (tractions, dips, pompes, squats)
    const bodyweightDisplacedKg = athleteWeightKg * profile.bodyweightDisplacementRatio;
    const bodyweightJoules = bodyweightDisplacedKg * reps * 9.81 * 0.50;
    const bodyweightKcal = (bodyweightJoules / 4184) / 0.22;

    // Dépense EPOC immédiate post-série (restauration ATP-PCr et métabolisme anaérobie lactique)
    // Plus le mouvement est polyarticulaire et lourd, plus l'EPOC par série est marqué (2 à 5 kcal)
    const setEpocKcal = (baseMet / 8.0) * 3.5;

    const setTotalKcal = baseSetKcal + (mechanicalKcal * 0.6) + (bodyweightKcal * 0.6) + setEpocKcal;
    totalExerciseKcal += setTotalKcal;
  });

  return {
    calories: Math.round(totalExerciseKcal),
    completedSets: completedSets.length,
    volumeKg: Math.round(totalVolumeKg),
  };
}

/**
 * Calcule la dépense calorique complète et réaliste d'une séance d'entraînement
 */
export function calculateWorkoutCalories(params: {
  exercises: ExerciseCalorieInput[];
  durationSeconds: number;
  userWeightKg?: number | null;
}): WorkoutCalorieResult {
  const { exercises, durationSeconds } = params;
  const athleteWeight =
    params.userWeightKg && params.userWeightKg >= 35 && params.userWeightKg <= 250
      ? params.userWeightKg
      : DEFAULT_ATHLETE_WEIGHT_KG;

  const validDurationSec = Math.max(60, durationSeconds || 1800);
  const totalDurationHours = validDurationSec / 3600;

  let sumActiveCalories = 0;
  let totalCompletedSets = 0;
  let totalSessionVolume = 0;
  const breakdown: WorkoutCalorieResult['breakdown'] = [];

  // 1. Calcul exercice par exercice
  exercises.forEach((ex) => {
    const res = calculateExerciseCalories(ex, athleteWeight);
    if (res.completedSets > 0) {
      sumActiveCalories += res.calories;
      totalCompletedSets += res.completedSets;
      totalSessionVolume += res.volumeKg;
      breakdown.push({
        exerciseName: ex.name,
        calories: res.calories,
        completedSets: res.completedSets,
        volumeKg: res.volumeKg,
      });
    }
  });

  // 2. Gestion des temps de repos et récupération de séance (EPOC global)
  // Temps moyen sous tension (TUT) ~ 35s par série
  const estimatedActiveTimeSec = totalCompletedSets * 35;
  const restTimeSec = Math.max(0, validDurationSec - estimatedActiveTimeSec);
  const restTimeHours = Math.min(2.5, restTimeSec / 3600); // Plafonner pour éviter dérive si séance oubliée

  // Durant les temps de repos en salle, le métabolisme reste stimulé à ~2.8 METs (récupération active post-série)
  const restMet = Math.min(3.6, 2.4 + (sumActiveCalories / Math.max(1, totalCompletedSets * 12)));
  const restAndEpocKcal = restMet * athleteWeight * restTimeHours;

  let totalKcal = Math.round(sumActiveCalories + restAndEpocKcal);

  // Garde-fous scientifiques :
  // Si aucune série n'a été validée (séance vide ou chronomètre seul) :
  if (totalCompletedSets === 0) {
    // Brûlage équivalent à une marche / présence active modérée ~2.5 METs
    totalKcal = Math.round(2.5 * athleteWeight * Math.min(1.5, totalDurationHours));
  } else {
    // Plage biomécanique réaliste pour la musculation :
    // Minimum 12 kcal / série terminée, maximum 35 kcal / série terminée
    const minPlausible = Math.round(totalCompletedSets * 12);
    const maxPlausible = Math.round(totalCompletedSets * 35 + totalDurationHours * 100);
    totalKcal = Math.max(minPlausible, Math.min(maxPlausible, totalKcal));
  }

  // Calcul du MET moyen de la séance
  const avgMet =
    totalDurationHours > 0
      ? Math.round((totalKcal / (athleteWeight * totalDurationHours)) * 10) / 10
      : 5.0;

  // Catégorisation de l'intensité
  let intensityCategory: WorkoutCalorieResult['intensityCategory'] = 'moderate';
  let intensityLabel = 'Intensité Modérée';

  if (avgMet >= 7.0 || (totalSessionVolume > 15000 && totalCompletedSets >= 18)) {
    intensityCategory = 'very_intense';
    intensityLabel = 'Très Haute Intensité (Tonnage Lourd & Polyarticulaire)';
  } else if (avgMet >= 5.5 || totalCompletedSets >= 14) {
    intensityCategory = 'intense';
    intensityLabel = 'Intensité Élevée (Entraînement Rigoureux)';
  } else if (avgMet <= 3.8) {
    intensityCategory = 'light';
    intensityLabel = 'Intensité Modérée / Récupération Active';
  }

  return {
    totalCalories: totalKcal,
    activeCalories: Math.round(sumActiveCalories),
    epocCalories: Math.round(restAndEpocKcal),
    averageMet: avgMet,
    intensityCategory,
    intensityLabel,
    breakdown,
  };
}

/**
 * Formate un nombre de calories brûlées avec symbole et unité
 */
export function formatWorkoutCalories(calories?: number | null): string {
  if (calories === undefined || calories === null || isNaN(calories) || calories <= 0) {
    return '-- kcal';
  }
  return `~${Math.round(calories)} kcal`;
}
