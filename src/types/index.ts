export type DifficultyLevel = 'Débutant' | 'Intermédiaire' | 'Avancé';

export type MuscleGroup =
  | 'Pectoraux'
  | 'Dos'
  | 'Épaules'
  | 'Biceps'
  | 'Triceps'
  | 'Jambes'
  | 'Abdominaux'
  | 'Corps Entier'
  | 'Cardio';

export type Equipment =
  | 'Sans matériel'
  | 'Poids du corps'
  | 'Barre de traction'
  | 'Barres parallèles'
  | 'Haltères'
  | 'Barre'
  | 'Banc'
  | 'Poulie / Machine'
  | 'Kettlebell'
  | 'Élastique'
  | 'Tapis de course'
  | 'Vélo elliptique'
  | 'Corde à sauter'
  | 'Roue abdominale'
  | 'Cardio';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  target_muscle: MuscleGroup | string;
  equipment_needed: Equipment | string;
  is_custom: number; // 0 or 1
}

export interface ExerciseRating {
  id: string;
  exercise_id: string;
  exercise_name?: string;
  rating: number; // 1 to 5
  criteria_animation?: number; // 1 to 5
  criteria_clarity?: number; // 1 to 5
  criteria_feeling?: number; // 1 to 5
  difficulty_tag?: 'too_easy' | 'perfect' | 'too_hard';
  comment?: string;
  user_name?: string;
  user_id?: string;
  created_at: string;
}

export interface ExerciseRatingSummary {
  exerciseId: string;
  averageRating: number;
  totalRatings: number;
  ratingsBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
  userRating?: ExerciseRating;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  difficulty_level: DifficultyLevel;
  is_custom: number; // 0 or 1
  created_at?: string;
  exercises_count?: number;
  required_equipments?: string;
}

export interface ProgramExercise {
  id: string;
  program_id: string;
  exercise_id: string;
  default_sets: number;
  default_reps: number;
  rest_time_seconds: number;
  order_index: number;
}

export interface ProgramExerciseDetail extends ProgramExercise {
  name: string;
  description: string;
  target_muscle: string;
  equipment_needed: string;
}

export interface WorkoutSession {
  id: string;
  program_id: string | null;
  program_name: string | null;
  date: string; // ISO 8601 string
  duration_seconds: number;
  notes: string | null;
  total_volume: number; // kg * reps
  total_sets: number;
  completed: number; // 0 or 1
  calories?: number | null;
}

export interface WorkoutSet {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  set_order: number;
  weight: number;
  reps: number;
  completed: number; // 0 or 1
  created_at?: string;
}

export interface WorkoutSetDetail extends WorkoutSet {
  exercise_name: string;
  target_muscle: string;
}

export interface WorkoutSessionWithSets extends WorkoutSession {
  sets: WorkoutSetDetail[];
}

export interface ActiveWorkoutSetItem {
  id: string;
  set_order: number;
  weight: number;
  reps: number;
  target_reps: number;
  completed: boolean;
  previous_weight?: number;
  previous_reps?: number;
}

export interface ActiveWorkoutExerciseItem {
  exercise: Exercise;
  rest_time_seconds: number;
  sets: ActiveWorkoutSetItem[];
}

export interface ExerciseHistoryPoint {
  date: string;
  max_weight: number;
  max_reps: number;
  total_volume: number;
  estimated_1rm: number;
}

export interface UserPreferences {
  user_name?: string;
  email?: string | null;
  avatar_url?: string;
  user_height_cm?: number;
  available_equipments?: Equipment[];
  filter_by_available_equipment?: boolean;
  default_rest_seconds: number;
  haptic_enabled: boolean;
  sound_enabled: boolean;
  weight_unit: 'kg' | 'lbs';
}

export interface BackupData {
  app: 'Vitax';
  version: '1.0';
  exported_at: string;
  exercises: Exercise[];
  programs: Program[];
  program_exercises: ProgramExercise[];
  workout_sessions: WorkoutSession[];
  workout_sets: WorkoutSet[];
  body_weights?: BodyWeightLog[];
  fitness_goals?: FitnessGoal[];
  running_sessions?: RunningSession[];
  favorite_exercise_ids?: string[];
  preferences?: UserPreferences;
}

// -------------------------------------------------------------
// BODYWEIGHT & FITNESS GOALS SYSTEM
// -------------------------------------------------------------
export interface BodyWeightLog {
  id: string;
  weight: number;
  date: string;
  note?: string;
  body_fat_percentage?: number;
  created_at: string;
}

export type GoalCategory = 'weight' | 'exercise' | 'custom';

export interface FitnessGoal {
  id: string;
  title: string;
  category: GoalCategory;
  target_value: number;
  starting_value: number;
  current_value: number;
  unit: string;
  target_date?: string;
  exercise_id?: string;
  exercise_name?: string;
  completed: number;
  completed_at?: string;
  created_at: string;
}

export interface WeightProgressStats {
  currentWeight: number | null;
  startingWeight: number | null;
  lowestWeight: number | null;
  highestWeight: number | null;
  deltaTotal: number;
  delta7Days: number;
  delta30Days: number;
  logsCount: number;
  bmi: number | null;
  latestBodyFat?: number | null;
}

// -------------------------------------------------------------
// COURSE À PIED & ENDURANCE (RUNNING)
// -------------------------------------------------------------
export interface RunningSession {
  id: string;
  date: string;
  distance_km: number;
  duration_seconds: number;
  pace_seconds_per_km: number;
  notes: string | null;
  calories: number | null;
  created_at: string;
  xp_earned?: number;
}

export interface RunningStats {
  totalSessions: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  bestPaceSecondsPerKm: number;
  averagePaceSecondsPerKm: number;
  averageDistanceKm: number;
  totalXpEarned?: number;
}

