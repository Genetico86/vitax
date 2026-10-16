import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import {
  ActiveWorkoutExerciseItem,
  ActiveWorkoutSetItem,
  Exercise,
  WorkoutSession,
  WorkoutSet,
  EggHatchResult,
  PokemonEgg,
} from '../types';
import { getProgramById } from '../database/programRepository';
import { getLastPerformanceForExercise } from '../database/exerciseRepository';
import { saveWorkoutSession } from '../database/workoutRepository';
import {
  distributeWorkoutXpToIncubators,
  determineWorkoutEggDrop,
  getActiveBuddyBuff,
} from '../services/pokemonEggService';
import { useSettingsStore } from './settingsStore';
import { computeSetXp, claimDailyWorkoutBonus } from '../services/exerciseWeightingService';

interface RestTimerState {
  isRunning: boolean;
  totalDuration: number;
  remainingSeconds: number;
  exerciseName: string;
}

interface WorkoutSessionState {
  isActive: boolean;
  sessionId: string | null;
  programId: string | null;
  programName: string | null;
  startTime: number | null;
  elapsedSeconds: number;
  notes: string;
  exercises: ActiveWorkoutExerciseItem[];
  restTimer: RestTimerState;
  activeSessionXp: number;
  lastCompletedSession: {
    session: WorkoutSession;
    sets: WorkoutSet[];
    hatchedPokemon?: EggHatchResult[];
    incubatingEggsProgress?: PokemonEgg[];
    droppedEgg?: PokemonEgg | null;
    inventoryFullNotice?: boolean;
  } | null;

  // Actions d'initialisation
  startWorkoutFromProgram: (programId: string) => Promise<void>;
  startFreeWorkout: () => void;
  startTargetedWorkout: (targetName: string, exercisesToInclude: Exercise[]) => Promise<void>;
  startCustomConfiguredWorkout: (
    title: string,
    configuredExercises: {
      exercise: Exercise;
      sets: number;
      targetReps: number;
      restSeconds: number;
    }[]
  ) => Promise<void>;
  cancelWorkout: () => void;
  finishWorkout: () => Promise<{ session: WorkoutSession; sets: WorkoutSet[] } | null>;

  // Gestion des exercices
  addExerciseToWorkout: (exercise: Exercise, defaultSets?: number, defaultReps?: number, restSec?: number) => Promise<void>;
  removeExerciseFromWorkout: (exerciseIndex: number) => void;

  // Gestion des séries
  addSetToExercise: (exerciseIndex: number) => void;
  removeSetFromExercise: (exerciseIndex: number, setIndex: number) => void;
  updateSetValues: (exerciseIndex: number, setIndex: number, weight: number, reps: number) => void;
  toggleSetCompleted: (exerciseIndex: number, setIndex: number) => void;

  // Chronomètres
  tickWorkoutTimer: () => void;
  startRestTimer: (seconds: number, exerciseName: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;
  tickRestTimer: () => void;

  setNotes: (notes: string) => void;
}

function computeSessionXpFromExercises(exercises: ActiveWorkoutExerciseItem[]): number {
  let sessionXp = 0;
  exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      if (s.completed || (s.weight > 0 && s.reps > 0)) {
        const computed = computeSetXp({
          exerciseName: ex.exercise.name,
          targetMuscle: ex.exercise.target_muscle,
          equipmentNeeded: ex.exercise.equipment_needed,
          weight: s.weight || 0,
          reps: s.reps || 0,
        });
        sessionXp += computed.totalSetXp;
      }
    });
  });
  return sessionXp;
}

export const useWorkoutSessionStore = create<WorkoutSessionState>((set, get) => ({
  isActive: false,
  sessionId: null,
  programId: null,
  programName: null,
  startTime: null,
  elapsedSeconds: 0,
  notes: '',
  exercises: [],
  restTimer: {
    isRunning: false,
    totalDuration: 90,
    remainingSeconds: 0,
    exerciseName: '',
  },
  activeSessionXp: 0,
  lastCompletedSession: null,

  startWorkoutFromProgram: async (programId: string) => {
    const data = await getProgramById(programId);
    if (!data) return;

    const { program, exercises: progExercises } = data;
    const defaultRest = useSettingsStore.getState().default_rest_seconds;

    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const pe of progExercises) {
      // Récupérer la dernière performance pour cet exercice pour pré-remplir intelligemment
      const lastPerf = await getLastPerformanceForExercise(pe.exercise_id);
      const sets: ActiveWorkoutSetItem[] = [];

      for (let s = 1; s <= pe.default_sets; s++) {
        sets.push({
          id: `set_${pe.exercise_id}_${s}_${Date.now()}_${Math.random()}`,
          set_order: s,
          weight: lastPerf?.weight ?? 0,
          reps: lastPerf?.reps ?? pe.default_reps,
          target_reps: pe.default_reps,
          completed: false,
          previous_weight: lastPerf?.weight,
          previous_reps: lastPerf?.reps,
        });
      }

      activeExercises.push({
        exercise: {
          id: pe.exercise_id,
          name: pe.name,
          description: pe.description,
          target_muscle: pe.target_muscle,
          equipment_needed: pe.equipment_needed,
          is_custom: 0,
        },
        rest_time_seconds: pe.rest_time_seconds || defaultRest,
        sets,
      });
    }

    set({
      isActive: true,
      sessionId: `workout_${Date.now()}`,
      programId: program.id,
      programName: program.name,
      startTime: Date.now(),
      elapsedSeconds: 0,
      notes: '',
      exercises: activeExercises,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
      },
    });
  },

  startFreeWorkout: () => {
    const defaultRest = useSettingsStore.getState().default_rest_seconds;
    set({
      isActive: true,
      sessionId: `workout_${Date.now()}`,
      programId: null,
      programName: 'Séance libre',
      startTime: Date.now(),
      elapsedSeconds: 0,
      notes: '',
      exercises: [],
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
      },
    });
  },

  startTargetedWorkout: async (targetName: string, exercisesToInclude: Exercise[]) => {
    const defaultRest = useSettingsStore.getState().default_rest_seconds;
    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const ex of exercisesToInclude) {
      const lastPerf = await getLastPerformanceForExercise(ex.id);
      const sets: ActiveWorkoutSetItem[] = [];
      const defaultSets = 3;
      const defaultReps = 10;

      for (let s = 1; s <= defaultSets; s++) {
        sets.push({
          id: `set_${ex.id}_${s}_${Date.now()}_${Math.random()}`,
          set_order: s,
          weight: lastPerf?.weight ?? 0,
          reps: lastPerf?.reps ?? defaultReps,
          target_reps: defaultReps,
          completed: false,
          previous_weight: lastPerf?.weight,
          previous_reps: lastPerf?.reps,
        });
      }

      activeExercises.push({
        exercise: ex,
        rest_time_seconds: defaultRest,
        sets,
      });
    }

    set({
      isActive: true,
      sessionId: `workout_${Date.now()}`,
      programId: null,
      programName: `Séance Ciblée : ${targetName}`,
      startTime: Date.now(),
      elapsedSeconds: 0,
      notes: '',
      exercises: activeExercises,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
      },
    });
  },

  startCustomConfiguredWorkout: async (
    title: string,
    configuredExercises: {
      exercise: Exercise;
      sets: number;
      targetReps: number;
      restSeconds: number;
    }[]
  ) => {
    const defaultRest = useSettingsStore.getState().default_rest_seconds;
    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const item of configuredExercises) {
      const lastPerf = await getLastPerformanceForExercise(item.exercise.id);
      const sets: ActiveWorkoutSetItem[] = [];

      for (let s = 1; s <= item.sets; s++) {
        sets.push({
          id: `set_${item.exercise.id}_${s}_${Date.now()}_${Math.random()}`,
          set_order: s,
          weight: lastPerf?.weight ?? 0,
          reps: lastPerf?.reps ?? item.targetReps,
          target_reps: item.targetReps,
          completed: false,
          previous_weight: lastPerf?.weight,
          previous_reps: lastPerf?.reps,
        });
      }

      activeExercises.push({
        exercise: item.exercise,
        rest_time_seconds: item.restSeconds || defaultRest,
        sets,
      });
    }

    set({
      isActive: true,
      sessionId: `workout_${Date.now()}`,
      programId: null,
      programName: title,
      startTime: Date.now(),
      elapsedSeconds: 0,
      notes: '',
      exercises: activeExercises,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
      },
    });
  },

  cancelWorkout: () => {
    set({
      isActive: false,
      sessionId: null,
      programId: null,
      programName: null,
      startTime: null,
      elapsedSeconds: 0,
      notes: '',
      exercises: [],
      restTimer: {
        isRunning: false,
        totalDuration: 90,
        remainingSeconds: 0,
        exerciseName: '',
      },
    });
  },

  addExerciseToWorkout: async (
    exercise: Exercise,
    defaultSets = 3,
    defaultReps = 10,
    restSec
  ) => {
    const defaultRest = restSec || useSettingsStore.getState().default_rest_seconds;
    const lastPerf = await getLastPerformanceForExercise(exercise.id);

    const sets: ActiveWorkoutSetItem[] = [];
    for (let s = 1; s <= defaultSets; s++) {
      sets.push({
        id: `set_${exercise.id}_${s}_${Date.now()}_${Math.random()}`,
        set_order: s,
        weight: lastPerf?.weight ?? 0,
        reps: lastPerf?.reps ?? defaultReps,
        target_reps: defaultReps,
        completed: false,
        previous_weight: lastPerf?.weight,
        previous_reps: lastPerf?.reps,
      });
    }

    set((state) => ({
      exercises: [
        ...state.exercises,
        {
          exercise,
          rest_time_seconds: defaultRest,
          sets,
        },
      ],
    }));
  },

  removeExerciseFromWorkout: (exerciseIndex: number) => {
    set((state) => ({
      exercises: state.exercises.filter((_, idx) => idx !== exerciseIndex),
    }));
  },

  addSetToExercise: (exerciseIndex: number) => {
    set((state) => {
      const updated = [...state.exercises];
      const targetEx = updated[exerciseIndex];
      if (!targetEx) return state;

      const lastSet = targetEx.sets[targetEx.sets.length - 1];
      const nextOrder = targetEx.sets.length + 1;

      targetEx.sets.push({
        id: `set_${targetEx.exercise.id}_${nextOrder}_${Date.now()}`,
        set_order: nextOrder,
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 10,
        target_reps: lastSet ? lastSet.target_reps : 10,
        completed: false,
        previous_weight: lastSet?.previous_weight,
        previous_reps: lastSet?.previous_reps,
      });

      return { exercises: updated };
    });
  },

  removeSetFromExercise: (exerciseIndex: number, setIndex: number) => {
    set((state) => {
      const updated = [...state.exercises];
      const targetEx = updated[exerciseIndex];
      if (!targetEx) return state;

      targetEx.sets = targetEx.sets.filter((_, idx) => idx !== setIndex);
      // Réajuster l'ordre
      targetEx.sets.forEach((s, idx) => {
        s.set_order = idx + 1;
      });

      return { exercises: updated };
    });
  },

  updateSetValues: (exerciseIndex: number, setIndex: number, weight: number, reps: number) => {
    set((state) => {
      const updated = [...state.exercises];
      const targetEx = updated[exerciseIndex];
      if (!targetEx || !targetEx.sets[setIndex]) return state;

      targetEx.sets[setIndex].weight = Math.max(0, weight);
      targetEx.sets[setIndex].reps = Math.max(0, reps);

      const liveXp = computeSessionXpFromExercises(updated);
      return { exercises: updated, activeSessionXp: liveXp };
    });
  },

  toggleSetCompleted: (exerciseIndex: number, setIndex: number) => {
    const state = get();
    const updated = [...state.exercises];
    const targetEx = updated[exerciseIndex];
    if (!targetEx || !targetEx.sets[setIndex]) return;

    const setItem = targetEx.sets[setIndex];
    const nextCompleted = !setItem.completed;
    setItem.completed = nextCompleted;

    const hapticEnabled = useSettingsStore.getState().haptic_enabled;

    if (nextCompleted) {
      if (hapticEnabled) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore if haptics unavailable on emulator
        }
      }

      // Lancement automatique du chronomètre de repos
      state.startRestTimer(targetEx.rest_time_seconds, targetEx.exercise.name);
    } else {
      if (hapticEnabled) {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }
    }

    const liveXp = computeSessionXpFromExercises(updated);
    set({ exercises: updated, activeSessionXp: liveXp });
  },

  tickWorkoutTimer: () => {
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
  },

  startRestTimer: (seconds: number, exerciseName: string) => {
    set({
      restTimer: {
        isRunning: true,
        totalDuration: seconds,
        remainingSeconds: seconds,
        exerciseName,
      },
    });
  },

  adjustRestTimer: (deltaSeconds: number) => {
    set((state) => {
      const newRemaining = Math.max(0, state.restTimer.remainingSeconds + deltaSeconds);
      const newTotal = Math.max(newRemaining, state.restTimer.totalDuration + deltaSeconds);
      return {
        restTimer: {
          ...state.restTimer,
          remainingSeconds: newRemaining,
          totalDuration: newTotal,
        },
      };
    });
  },

  skipRestTimer: () => {
    set((state) => ({
      restTimer: {
        ...state.restTimer,
        isRunning: false,
        remainingSeconds: 0,
      },
    }));
  },

  tickRestTimer: () => {
    const state = get();
    if (!state.restTimer.isRunning) return;

    if (state.restTimer.remainingSeconds <= 1) {
      const hapticEnabled = useSettingsStore.getState().haptic_enabled;
      if (hapticEnabled) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}
      }
      set({
        restTimer: {
          ...state.restTimer,
          isRunning: false,
          remainingSeconds: 0,
        },
      });
    } else {
      set({
        restTimer: {
          ...state.restTimer,
          remainingSeconds: state.restTimer.remainingSeconds - 1,
        },
      });
    }
  },

  setNotes: (notes: string) => {
    set({ notes });
  },

  finishWorkout: async () => {
    const state = get();
    if (!state.sessionId) return null;

    const allSets: WorkoutSet[] = [];
    let completedCount = 0;
    let totalVol = 0;

    state.exercises.forEach((exItem) => {
      exItem.sets.forEach((s) => {
        const isEffectivelyCompleted = s.completed || s.reps > 0;
        if (isEffectivelyCompleted) {
          completedCount += 1;
          totalVol += s.weight * s.reps;
        }
        allSets.push({
          id: s.id,
          workout_session_id: state.sessionId!,
          exercise_id: exItem.exercise.id,
          set_order: s.set_order,
          weight: s.weight,
          reps: s.reps,
          completed: isEffectivelyCompleted ? 1 : 0,
        });
      });
    });

    const session: WorkoutSession = {
      id: state.sessionId,
      program_id: state.programId,
      program_name: state.programName,
      date: new Date().toISOString(),
      duration_seconds: state.elapsedSeconds,
      notes: state.notes || null,
      total_volume: totalVol,
      total_sets: completedCount,
      completed: 1,
    };

    // Sauvegarde immédiate dans SQLite
    await saveWorkoutSession(session, allSets);

    // Calcul de l'XP biomécanique des séries + bonus journalier d'entraînement
    const setsXp = computeSessionXpFromExercises(state.exercises);
    let dailyBonusXp = 0;
    if (completedCount > 0) {
      try {
        const bonusRes = await claimDailyWorkoutBonus();
        if (bonusRes.awarded) {
          dailyBonusXp = bonusRes.bonusXp;
        }
      } catch (bErr) {
        console.warn('Erreur claimDailyWorkoutBonus:', bErr);
      }
    }

    // Bonus du Compagnon Actif (Option A)
    let buddyBonusXp = 0;
    try {
      const buddyBuff = await getActiveBuddyBuff();
      if (buddyBuff) {
        if (buddyBuff.type === 'combat') {
          buddyBonusXp += Math.round(setsXp * 0.10);
        } else if (buddyBuff.type === 'feu' && (session.duration_seconds >= 2400 || completedCount >= 10)) {
          buddyBonusXp += Math.round(setsXp * 0.10);
        } else if (buddyBuff.type === 'roche' && (session.total_volume || 0) >= 2000) {
          const tonnes = Math.floor((session.total_volume || 0) / 2000);
          buddyBonusXp += tonnes * 50;
        } else if (buddyBuff.type === 'eau') {
          buddyBonusXp += Math.round(setsXp * 0.05);
        } else if (buddyBuff.type === 'plante') {
          buddyBonusXp += Math.round(setsXp * 0.15);
        }
      }
    } catch (bErr) {
      console.warn('Erreur calcul buddy buff:', bErr);
    }

    const totalEarnedXp = setsXp + dailyBonusXp + buddyBonusXp;
    let hatchedPokemon: EggHatchResult[] = [];
    let incubatingEggsProgress: PokemonEgg[] = [];

    try {
      const incubationResult = await distributeWorkoutXpToIncubators(totalEarnedXp);
      hatchedPokemon = incubationResult.newlyHatched;
      incubatingEggsProgress = incubationResult.updatedEggs;
    } catch (err) {
      console.error('Erreur distribution XP incubateurs:', err);
    }

    // Drop automatique d'un œuf en fin de séance (Option A)
    let droppedEgg: PokemonEgg | null = null;
    let inventoryFullNotice = false;
    try {
      const dropRes = await determineWorkoutEggDrop({
        durationSeconds: session.duration_seconds,
        completedSets: completedCount,
        totalVolumeKg: session.total_volume || 0,
        programName: session.program_name,
      });
      if (dropRes.egg) {
        droppedEgg = dropRes.egg;
      } else if (dropRes.reason === 'inventory_full') {
        inventoryFullNotice = true;
      }
    } catch (dropErr) {
      console.warn('Erreur drop œuf fin de séance:', dropErr);
    }

    // Mise à jour immédiate du profil athlète (XP, séances, tonnage & ligue)
    try {
      const { updateTrainerProfileXpAndStats } = await import('../services/multiplayerService');
      await updateTrainerProfileXpAndStats(totalEarnedXp, session.total_volume || 0);
    } catch (err) {
      console.warn('Erreur mise à jour XP profil:', err);
    }

    // Arrêt de la session active et enregistrement du résumé
    set({
      isActive: false,
      sessionId: null,
      programId: null,
      programName: null,
      startTime: null,
      elapsedSeconds: 0,
      notes: '',
      exercises: [],
      activeSessionXp: 0,
      restTimer: {
        isRunning: false,
        totalDuration: 90,
        remainingSeconds: 0,
        exerciseName: '',
      },
      lastCompletedSession: {
        session,
        sets: allSets,
        hatchedPokemon,
        incubatingEggsProgress,
        droppedEgg,
        inventoryFullNotice,
      },
    });

    return { session, sets: allSets };
  },
}));
