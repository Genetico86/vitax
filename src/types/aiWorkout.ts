import { Equipment, DifficultyLevel } from './index';

export type TargetFocus =
  | 'full_body'
  | 'upper_body'
  | 'lower_body'
  | 'push'
  | 'pull'
  | 'legs'
  | 'pecs_triceps'
  | 'dos_biceps'
  | 'shoulders'
  | 'glutes_hamstrings'
  | 'abs_core';

export type WorkoutTrainingType =
  | 'hypertrophy'
  | 'strength'
  | 'hiit'
  | 'endurance'
  | 'mobility';

export interface AIWorkoutGeneratorParams {
  targetFocus: TargetFocus;
  trainingType: WorkoutTrainingType;
  difficulty: DifficultyLevel;
  durationMinutes: number; // e.g. 30, 45, 60, 75
  availableEquipments: Equipment[] | string[];
  userNotes?: string;
}

export type ExercisePhase = 'warmup' | 'compound' | 'isolation' | 'cooldown';

export interface GeneratedExercise {
  exercise_id?: string;
  name: string;
  target_muscle: string;
  equipment_needed: string;
  phase: ExercisePhase;
  sets: number;
  reps: string; // e.g. "5 reps", "8-10 reps", "15 reps", "45s"
  rest_seconds: number;
  tempo: string; // e.g. "3-0-1-0", "Explosif", "2-1-2-0"
  rpe: string; // e.g. "RPE 8", "RPE 9", "RPE 6-7"
  execution_tip: string;
  alternative_exercise: string;
}

export interface GeneratedWorkoutPlan {
  id: string;
  title: string;
  subtitle: string;
  targetFocus: TargetFocus;
  trainingType: WorkoutTrainingType;
  difficulty: DifficultyLevel;
  estimated_duration_minutes: number;
  warmup_advice: string;
  cooldown_advice: string;
  sports_science_rationale: string;
  exercises: GeneratedExercise[];
  created_at: string;
  is_offline_generated: boolean;
}

export const TARGET_FOCUS_OPTIONS: {
  id: TargetFocus;
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    id: 'full_body',
    label: 'Full Body',
    emoji: '⚡',
    description: 'Corps entier et chaînes musculaires globales',
  },
  {
    id: 'upper_body',
    label: 'Upper Body',
    emoji: '🦾',
    description: 'Haut du corps (Pectoraux, Dos, Épaules, Bras)',
  },
  {
    id: 'lower_body',
    label: 'Lower Body',
    emoji: '🦵',
    description: 'Bas du corps (Quadriceps, Ischios, Fessiers, Mollets)',
  },
  {
    id: 'push',
    label: 'Push (Poussée)',
    emoji: '🛡️',
    description: 'Pectoraux, Épaules avant/latérales & Triceps',
  },
  {
    id: 'pull',
    label: 'Pull (Tirage)',
    emoji: '🦅',
    description: 'Grand dorsal, Trapèzes, Arrière d’épaules & Biceps',
  },
  {
    id: 'legs',
    label: 'Legs (Cuisses & Fessiers)',
    emoji: '💥',
    description: 'Quadriceps, Chaîne postérieure & Fessiers',
  },
  {
    id: 'pecs_triceps',
    label: 'Pectoraux & Triceps',
    emoji: '🥊',
    description: 'Focus poussée pectorale et verrouillage des bras',
  },
  {
    id: 'dos_biceps',
    label: 'Dos & Biceps',
    emoji: '🧗',
    description: 'Tirages lourds, largeur en V et volume des bras',
  },
  {
    id: 'shoulders',
    label: 'Épaules 3D',
    emoji: '🎯',
    description: 'Galbe complet : faisceaux antérieur, latéral & postérieur',
  },
  {
    id: 'glutes_hamstrings',
    label: 'Fessiers & Ischios',
    emoji: '🍑',
    description: 'Chaîne postérieure, hip thrust et flexions de hanche',
  },
  {
    id: 'abs_core',
    label: 'Abdos & Gainage',
    emoji: '🍫',
    description: 'Grand droit, obliques, transverse et stabilité lombaire',
  },
];

export const TRAINING_TYPE_OPTIONS: {
  id: WorkoutTrainingType;
  label: string;
  emoji: string;
  badge: string;
  description: string;
  repRange: string;
  restRange: string;
}[] = [
  {
    id: 'hypertrophy',
    label: 'Prise de masse / Hypertrophie',
    emoji: '💪',
    badge: 'VOLUME & MASSE',
    description: 'Tension mécanique maximale et congestion (8 à 12 reps, repos 90-120s)',
    repRange: '8-12 reps',
    restRange: '90-120s',
  },
  {
    id: 'strength',
    label: 'Force pure & Puissance',
    emoji: '🏋️‍♂️',
    badge: 'FORCE MAXIMALE',
    description: 'Charges lourdes et recrutement nerveux (3 à 5 reps, repos 3-4 min)',
    repRange: '3-5 reps',
    restRange: '180-240s',
  },
  {
    id: 'hiit',
    label: 'HIIT / Circuit training',
    emoji: '🔥',
    badge: 'BRÛLE-GRAISSES',
    description: 'Rythme cardiaque élevé et dépense métabolique (intervalles courts)',
    repRange: '15-20 reps / 45s',
    restRange: '30-45s',
  },
  {
    id: 'endurance',
    label: 'Endurance musculaire',
    emoji: '🏃',
    badge: 'RÉSISTANCE',
    description: 'Volume élevé, résistance à la brûlure et tonicité (15 à 25 reps)',
    repRange: '15-25 reps',
    restRange: '45-60s',
  },
  {
    id: 'mobility',
    label: 'Mobilité & Posture',
    emoji: '🧘',
    badge: 'SANTÉ ARTICULAIRE',
    description: 'Contrôle moteur, décompression vertébrale et santé articulaire',
    repRange: '10-12 reps contrôlées',
    restRange: '45-60s',
  },
];
