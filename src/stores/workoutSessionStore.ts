import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  ActiveWorkoutExerciseItem,
  ActiveWorkoutSetItem,
  Exercise,
  WorkoutSession,
  WorkoutSet,
} from '../types';
import { getProgramById } from '../database/programRepository';
import {
  getLastPerformanceForExercise,
  getLastPerformanceForExercises,
} from '../database/exerciseRepository';
import { saveWorkoutSession } from '../database/workoutRepository';
import { useSettingsStore } from './settingsStore';
import { computeSetXp, claimDailyWorkoutBonus } from '../services/exerciseWeightingService';
import { getExerciseUnitInfo } from '../utils/exerciseUnits';
import { calculateWorkoutCalories } from '../utils/workoutCalorieUtils';
import { getLatestWeightLog } from '../database/weightRepository';
import {
  STORAGE_KEY_ACTIVE_WORKOUT_DRAFT,
  syncActiveWorkoutDraftToCloud,
  clearActiveWorkoutDraftFromCloud,
  fetchActiveWorkoutDraftFromCloud,
} from '../services/cloudSyncService';

interface RestTimerState {
  isRunning: boolean;
  totalDuration: number;
  remainingSeconds: number;
  exerciseName: string;
  endTime?: number | null;
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
  } | null;

  // Actions d'initialisation et restauration
  restoreActiveWorkoutIfAny: () => Promise<boolean>;
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
  getEstimatedCaloriesBurned: () => number;

  // Gestion des exercices
  addExerciseToWorkout: (
    exercise: Exercise,
    defaultSets?: number,
    defaultReps?: number,
    restSec?: number
  ) => Promise<void>;
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
      if (s.completed) {
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

let draftSyncTimeout: ReturnType<typeof setTimeout> | null = null;

function persistActiveWorkoutDraft(state: WorkoutSessionState, immediateCloud = false): void {
  if (!state.isActive || !state.sessionId) return;
  const payload = {
    isActive: state.isActive,
    sessionId: state.sessionId,
    programId: state.programId,
    programName: state.programName,
    startTime: state.startTime,
    elapsedSeconds: state.elapsedSeconds,
    notes: state.notes,
    exercises: state.exercises,
    restTimer: state.restTimer,
    activeSessionXp: state.activeSessionXp,
    savedAt: Date.now(),
  };

  void AsyncStorage.setItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT, JSON.stringify(payload)).catch(
    () => {}
  );

  if (immediateCloud) {
    if (draftSyncTimeout) {
      clearTimeout(draftSyncTimeout);
      draftSyncTimeout = null;
    }
    void syncActiveWorkoutDraftToCloud(payload);
  } else {
    if (draftSyncTimeout) clearTimeout(draftSyncTimeout);
    draftSyncTimeout = setTimeout(() => {
      void syncActiveWorkoutDraftToCloud(payload);
    }, 600);
  }
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
    endTime: null,
  },
  activeSessionXp: 0,
  lastCompletedSession: null,

  restoreActiveWorkoutIfAny: async () => {
    if (get().isActive && get().sessionId) return true;
    try {
      let draft: any = null;
      const rawLocal = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT);
      if (rawLocal) {
        draft = JSON.parse(rawLocal);
      }
      if (!draft || !draft.isActive || !draft.sessionId) {
        draft = await fetchActiveWorkoutDraftFromCloud();
        if (draft) {
          await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT, JSON.stringify(draft));
        }
      }

      if (draft && draft.isActive && draft.sessionId) {
        const now = Date.now();
        const startTime = draft.startTime || now;
        const elapsedSeconds = Math.max(
          draft.elapsedSeconds || 0,
          Math.floor((now - startTime) / 1000)
        );

        let restTimer: RestTimerState = draft.restTimer || {
          isRunning: false,
          totalDuration: 90,
          remainingSeconds: 0,
          exerciseName: '',
          endTime: null,
        };
        if (restTimer.isRunning && restTimer.endTime) {
          const rem = Math.max(0, Math.ceil((restTimer.endTime - now) / 1000));
          restTimer = {
            ...restTimer,
            isRunning: rem > 0,
            remainingSeconds: rem,
          };
        }

        const exercises = Array.isArray(draft.exercises) ? draft.exercises : [];
        set({
          isActive: true,
          sessionId: draft.sessionId,
          programId: draft.programId ?? null,
          programName: draft.programName ?? 'Séance libre',
          startTime,
          elapsedSeconds,
          notes: draft.notes ?? '',
          exercises,
          restTimer,
          activeSessionXp: computeSessionXpFromExercises(exercises),
        });
        return true;
      }
    } catch (err) {
      console.warn('Erreur restauration séance active:', err);
    }
    return false;
  },

  startWorkoutFromProgram: async (programId: string) => {
    const data = await getProgramById(programId);
    if (!data) return;

    const { program, exercises: progExercises } = data;
    const defaultRest = useSettingsStore.getState().default_rest_seconds;
    const perfMap = await getLastPerformanceForExercises(
      progExercises.map((pe) => pe.exercise_id)
    );

    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const pe of progExercises) {
      const lastPerf = perfMap.get(pe.exercise_id) || null;
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
      activeSessionXp: 0,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
        endTime: null,
      },
    });
    persistActiveWorkoutDraft(get(), true);
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
      activeSessionXp: 0,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
        endTime: null,
      },
    });
    persistActiveWorkoutDraft(get(), true);
  },

  startTargetedWorkout: async (targetName: string, exercisesToInclude: Exercise[]) => {
    const defaultRest = useSettingsStore.getState().default_rest_seconds;
    const perfMap = await getLastPerformanceForExercises(
      exercisesToInclude.map((ex) => ex.id)
    );
    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const ex of exercisesToInclude) {
      const lastPerf = perfMap.get(ex.id) || null;
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
      activeSessionXp: 0,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
        endTime: null,
      },
    });
    persistActiveWorkoutDraft(get(), true);
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
    const perfMap = await getLastPerformanceForExercises(
      configuredExercises.map((item) => item.exercise.id)
    );
    const activeExercises: ActiveWorkoutExerciseItem[] = [];

    for (const item of configuredExercises) {
      const lastPerf = perfMap.get(item.exercise.id) || null;
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
      activeSessionXp: 0,
      restTimer: {
        isRunning: false,
        totalDuration: defaultRest,
        remainingSeconds: 0,
        exerciseName: '',
        endTime: null,
      },
    });
    persistActiveWorkoutDraft(get(), true);
  },

  cancelWorkout: () => {
    if (draftSyncTimeout) {
      clearTimeout(draftSyncTimeout);
      draftSyncTimeout = null;
    }
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
        endTime: null,
      },
    });
    void clearActiveWorkoutDraftFromCloud();
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
    persistActiveWorkoutDraft(get(), true);
  },

  removeExerciseFromWorkout: (exerciseIndex: number) => {
    set((state) => {
      const updated = state.exercises.filter((_, idx) => idx !== exerciseIndex);
      return {
        exercises: updated,
        activeSessionXp: computeSessionXpFromExercises(updated),
      };
    });
    persistActiveWorkoutDraft(get(), true);
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
    persistActiveWorkoutDraft(get(), false);
  },

  removeSetFromExercise: (exerciseIndex: number, setIndex: number) => {
    set((state) => {
      const updated = [...state.exercises];
      const targetEx = updated[exerciseIndex];
      if (!targetEx) return state;

      targetEx.sets = targetEx.sets.filter((_, idx) => idx !== setIndex);
      targetEx.sets.forEach((s, idx) => {
        s.set_order = idx + 1;
      });

      return {
        exercises: updated,
        activeSessionXp: computeSessionXpFromExercises(updated),
      };
    });
    persistActiveWorkoutDraft(get(), false);
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
    persistActiveWorkoutDraft(get(), false);
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
        } catch {}
      }

      // Lancement automatique du chronomètre de repos basé sur horodatage réel
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
    persistActiveWorkoutDraft(get(), true);
  },

  tickWorkoutTimer: () => {
    set((state) => {
      if (!state.isActive) return state;
      const elapsed = state.startTime
        ? Math.max(0, Math.floor((Date.now() - state.startTime) / 1000))
        : state.elapsedSeconds + 1;
      return { elapsedSeconds: elapsed };
    });
  },

  startRestTimer: (seconds: number, exerciseName: string) => {
    const endTime = Date.now() + seconds * 1000;
    set({
      restTimer: {
        isRunning: true,
        totalDuration: seconds,
        remainingSeconds: seconds,
        exerciseName,
        endTime,
      },
    });
  },

  adjustRestTimer: (deltaSeconds: number) => {
    set((state) => {
      const now = Date.now();
      const currentRem = state.restTimer.endTime
        ? Math.max(0, Math.ceil((state.restTimer.endTime - now) / 1000))
        : state.restTimer.remainingSeconds;
      const newRemaining = Math.max(0, currentRem + deltaSeconds);
      const newTotal = Math.max(newRemaining, state.restTimer.totalDuration + deltaSeconds);
      const newEndTime = now + newRemaining * 1000;
      return {
        restTimer: {
          ...state.restTimer,
          isRunning: newRemaining > 0,
          remainingSeconds: newRemaining,
          totalDuration: newTotal,
          endTime: newEndTime,
        },
      };
    });
    persistActiveWorkoutDraft(get(), false);
  },

  skipRestTimer: () => {
    set((state) => ({
      restTimer: {
        ...state.restTimer,
        isRunning: false,
        remainingSeconds: 0,
        endTime: null,
      },
    }));
    persistActiveWorkoutDraft(get(), false);
  },

  tickRestTimer: () => {
    const state = get();
    if (!state.restTimer.isRunning) return;

    const now = Date.now();
    const remaining = state.restTimer.endTime
      ? Math.max(0, Math.ceil((state.restTimer.endTime - now) / 1000))
      : Math.max(0, state.restTimer.remainingSeconds - 1);

    if (remaining <= 0) {
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
          endTime: null,
        },
      });
    } else if (remaining !== state.restTimer.remainingSeconds) {
      set({
        restTimer: {
          ...state.restTimer,
          remainingSeconds: remaining,
        },
      });
    }
  },

  setNotes: (notes: string) => {
    set({ notes });
    persistActiveWorkoutDraft(get(), false);
  },

  finishWorkout: async () => {
    const state = get();
    if (!state.sessionId) return null;

    if (draftSyncTimeout) {
      clearTimeout(draftSyncTimeout);
      draftSyncTimeout = null;
    }

    const allSets: WorkoutSet[] = [];
    let completedCount = 0;
    let totalVol = 0;

    state.exercises.forEach((exItem) => {
      const unitInfo = getExerciseUnitInfo(exItem.exercise);
      const isCardioOrTimeOnly = unitInfo.isTimeBased || unitInfo.loadUnit === 'km/h';

      exItem.sets.forEach((s) => {
        // Ne comptabiliser que les séries explicitement validées par l'utilisateur
        const isEffectivelyCompleted = Boolean(s.completed);
        if (isEffectivelyCompleted) {
          completedCount += 1;
          if (!isCardioOrTimeOnly) {
            totalVol += (s.weight || 0) * (s.reps || 0);
          }
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

    const finalElapsedSeconds = state.startTime
      ? Math.max(state.elapsedSeconds, Math.floor((Date.now() - state.startTime) / 1000))
      : state.elapsedSeconds;

    // Estimation précise et réaliste des calories brûlées
    let athleteWeightKg = 75;
    try {
      const latestWeight = await getLatestWeightLog();
      if (latestWeight?.weight && latestWeight.weight > 30) {
        athleteWeightKg = latestWeight.weight;
      }
    } catch {}

    const calorieInput = state.exercises.map((exItem) => ({
      name: exItem.exercise.name,
      targetMuscle: exItem.exercise.target_muscle,
      equipment: exItem.exercise.equipment_needed,
      sets: exItem.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: Boolean(s.completed),
      })),
    }));

    const calorieRes = calculateWorkoutCalories({
      exercises: calorieInput,
      durationSeconds: finalElapsedSeconds,
      userWeightKg: athleteWeightKg,
    });

    const session: WorkoutSession = {
      id: state.sessionId,
      program_id: state.programId,
      program_name: state.programName,
      date: new Date().toISOString(),
      duration_seconds: finalElapsedSeconds,
      notes: state.notes || null,
      total_volume: Math.round(totalVol),
      total_sets: completedCount,
      completed: 1,
      calories: calorieRes.totalCalories,
    };

    // Sauvegarde immédiate dans SQLite + synchronisation temps réel vers Supabase
    try {
      await saveWorkoutSession(session, allSets);
    } catch (saveErr) {
      console.error('Erreur critique saveWorkoutSession:', saveErr);
    }

    // Arrêt immédiat et inconditionnel de la session active et enregistrement du résumé
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
        endTime: null,
      },
      lastCompletedSession: {
        session,
        sets: allSets,
      },
    });

    void clearActiveWorkoutDraftFromCloud().catch(() => {});
    void AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT).catch(() => {});

    // Calcul de l'XP biomécanique des séries + bonus journalier d'entraînement
    try {
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

      const totalEarnedXp = setsXp + dailyBonusXp;

      // Mise à jour immédiate du profil athlète (XP, séances, tonnage & ligue) + validation auto des défis amis
      const {
        updateTrainerProfileXpAndStats,
        evaluateAndCompleteWorkoutChallenges,
      } = await import('../services/multiplayerService');

      await Promise.allSettled([
        updateTrainerProfileXpAndStats(totalEarnedXp, session.total_volume || 0),
        evaluateAndCompleteWorkoutChallenges({
          programId: session.program_id,
          totalVolumeKg: session.total_volume || 0,
          durationSeconds: session.duration_seconds || 0,
          sets: allSets,
        }),
      ]);
    } catch (err) {
      console.warn('Erreur mise à jour XP profil / défis (non-bloquant):', err);
    }

    return { session, sets: allSets };
  },

  getEstimatedCaloriesBurned: () => {
    const state = get();
    const currentElapsed = state.startTime
      ? Math.max(state.elapsedSeconds, Math.floor((Date.now() - state.startTime) / 1000))
      : state.elapsedSeconds;
    const mapped = state.exercises.map((exItem) => ({
      name: exItem.exercise.name,
      targetMuscle: exItem.exercise.target_muscle,
      equipment: exItem.exercise.equipment_needed,
      sets: exItem.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: Boolean(s.completed),
      })),
    }));
    return calculateWorkoutCalories({
      exercises: mapped,
      durationSeconds: currentElapsed,
    }).totalCalories;
  },
}));

