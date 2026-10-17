import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  WorkoutSession,
  WorkoutSet,
  WorkoutSessionWithSets,
  BodyWeightLog,
  FitnessGoal,
  PokemonEgg,
  RunningSession,
  Exercise,
  Program,
} from '../types';
import { getPersistedSession } from './authService';
import { getOrCreateTrainerProfile, syncTrainerProfileToSupabase } from './multiplayerService';
import { getDatabase, runInTransaction } from '../database/db';
import seedData from '../database/seedData.json';
import { getUserGamificationStats } from './gamificationService';
import { STORAGE_KEY_DAILY_BONUS } from './exerciseWeightingService';
import { STORAGE_KEY_PROFILE } from './multiplayer/profileService';

export const STORAGE_KEY_DELETED_IDS = '@vitax_deleted_ids';
export const STORAGE_KEY_ACTIVE_WORKOUT_DRAFT = '@vitax_active_workout_draft';
const SETTINGS_KEY = '@vitax_user_settings';

/**
 * Récupère la liste des identifiants supprimés (tombstones) pour éviter la résurrection d'entités supprimées
 */
export async function getDeletedIdsSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DELETED_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export async function markIdAsDeleted(id: string): Promise<void> {
  if (!id) return;
  try {
    const set = await getDeletedIdsSet();
    set.add(id);
    const list = Array.from(set).slice(-1000);
    await AsyncStorage.setItem(STORAGE_KEY_DELETED_IDS, JSON.stringify(list));
    void syncDeletedIdsToCloud(list);
  } catch (err) {
    console.warn('Erreur markIdAsDeleted:', err);
  }
}

export async function syncDeletedIdsToCloud(localList?: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return;
    const list = localList ?? Array.from(await getDeletedIdsSet());
    const backupId = `deleted_ids_${session.userId}`;
    await supabase.from('trades').upsert({
      id: backupId,
      sender_id: session.userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { deleted_ids: list },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });
  } catch {}
}

export async function fetchAndMergeDeletedIdsFromCloud(): Promise<Set<string>> {
  const localSet = await getDeletedIdsSet();
  if (!isSupabaseConfigured()) return localSet;
  const supabase = getSupabaseClient();
  if (!supabase) return localSet;
  try {
    const userId = await getActiveUserId();
    const backupId = `deleted_ids_${userId}`;
    const { data } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    const cloudIds = (data?.offered_pokemon as any)?.deleted_ids;
    if (Array.isArray(cloudIds)) {
      let changed = false;
      for (const id of cloudIds) {
        if (typeof id === 'string' && !localSet.has(id)) {
          localSet.add(id);
          changed = true;
        }
      }
      if (changed) {
        await AsyncStorage.setItem(
          STORAGE_KEY_DELETED_IDS,
          JSON.stringify(Array.from(localSet).slice(-1000))
        );
      }
    }
  } catch {}
  return localSet;
}

/**
 * Récupère l'identifiant unique de l'athlète actuel pour la synchronisation
 */
export async function getActiveUserId(): Promise<string> {
  const session = await getPersistedSession();
  if (session?.isLoggedIn && session.userId) {
    return session.userId;
  }
  const profile = await getOrCreateTrainerProfile();
  return profile.id;
}

/**
 * S'assure que le profil de l'athlète existe bien dans Supabase avant d'insérer des données liées
 */
async function ensureCloudProfileExists(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const profile = await getOrCreateTrainerProfile();
    await syncTrainerProfileToSupabase(profile);
  } catch (err) {
    console.warn('Erreur vérification profil cloud:', err);
  }
}

// =========================================================================
// 1. SYNCHRONISATION DES SÉANCES & SÉRIES (WORKOUTS)
// =========================================================================

export async function syncWorkoutSessionToCloud(
  session: WorkoutSession,
  sets: WorkoutSet[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

    // 1. Enregistrer / Mettre à jour la séance
    const { error: sessionError } = await supabase.from('workout_sessions').upsert({
      id: session.id,
      user_id: userId,
      program_id: session.program_id,
      program_name: session.program_name || 'Séance libre',
      date: session.date,
      duration_seconds: session.duration_seconds || 0,
      notes: session.notes,
      total_volume: session.total_volume || 0,
      total_sets: session.total_sets || 0,
      completed: session.completed !== undefined ? session.completed : 1,
      updated_at: new Date().toISOString(),
    });

    if (sessionError) {
      console.warn('Erreur synchro cloud workout_session:', sessionError.message);
      return false;
    }

    // 2. Nettoyer les séries précédentes et réinsérer les nouvelles
    await supabase.from('workout_sets').delete().eq('workout_session_id', session.id);

    if (sets.length > 0) {
      const now = new Date().toISOString();
      const setsToInsert = sets.map((s, idx) => ({
        id: s.id || `${session.id}_set_${idx}`,
        workout_session_id: session.id,
        user_id: userId,
        exercise_id: s.exercise_id,
        set_order: s.set_order !== undefined ? s.set_order : idx + 1,
        weight: s.weight || 0,
        reps: s.reps || 0,
        completed: s.completed !== undefined ? s.completed : 1,
        created_at: s.created_at || now,
      }));

      const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
      if (setsError) {
        console.warn('Erreur synchro cloud workout_sets:', setsError.message);
      }
    }

    return true;
  } catch (err: any) {
    console.warn('Exception synchro cloud séance:', err?.message);
    return false;
  }
}

export async function fetchWorkoutSessionsFromCloud(): Promise<WorkoutSession[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const userId = await getActiveUserId();
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error || !data) {
      if (error) console.warn('Erreur Supabase fetch workout_sessions:', error.message);
      return [];
    }

    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();
    const completedRows = data.filter(
      (row: any) =>
        row &&
        row.id &&
        !deletedIds.has(row.id) &&
        (row.completed === 1 ||
          row.completed === true ||
          row.completed === '1' ||
          row.completed === undefined ||
          row.completed === null)
    );

    return completedRows.map((row: any) => ({
      id: row.id,
      program_id: row.program_id,
      program_name: row.program_name,
      date: row.date,
      duration_seconds: row.duration_seconds,
      notes: row.notes,
      total_volume: row.total_volume,
      total_sets: row.total_sets,
      completed: 1,
    }));
  } catch (err) {
    console.warn('Erreur fetch cloud workout_sessions:', err);
    return [];
  }
}

export async function fetchWorkoutDetailsFromCloud(
  sessionId: string
): Promise<WorkoutSessionWithSets | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data: sessionData, error: sessionErr } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !sessionData) return null;

    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('workout_session_id', sessionId)
      .order('set_order', { ascending: true });

    const exercisesMap = new Map<string, { name: string; target_muscle: string }>();
    for (const ex of seedData.exercises) {
      exercisesMap.set(ex.id, { name: ex.name, target_muscle: ex.target_muscle });
    }

    const sets = (setsData || []).map((s: any) => {
      const meta = exercisesMap.get(s.exercise_id) || {
        name: s.exercise_id,
        target_muscle: 'Musculation',
      };
      return {
        id: s.id,
        workout_session_id: s.workout_session_id,
        exercise_id: s.exercise_id,
        set_order: s.set_order,
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        created_at: s.created_at,
        exercise_name: meta.name,
        target_muscle: meta.target_muscle,
      };
    });

    return {
      id: sessionData.id,
      program_id: sessionData.program_id,
      program_name: sessionData.program_name,
      date: sessionData.date,
      duration_seconds: sessionData.duration_seconds,
      notes: sessionData.notes,
      total_volume: sessionData.total_volume,
      total_sets: sessionData.total_sets,
      completed: sessionData.completed,
      sets,
    };
  } catch (err) {
    console.warn('Erreur fetch cloud détails séance:', err);
    return null;
  }
}

export async function deleteWorkoutSessionFromCloud(sessionId: string): Promise<boolean> {
  await markIdAsDeleted(sessionId);
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    await supabase.from('workout_sets').delete().eq('workout_session_id', sessionId);
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
    return !error;
  } catch {
    return false;
  }
}

// =========================================================================
// 2. SYNCHRONISATION DES FAVORIS
// =========================================================================

export async function syncFavoritesToCloud(exerciseIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

    // Supprimer les anciens favoris de cet utilisateur
    await supabase.from('user_favorites').delete().eq('user_id', userId);

    if (exerciseIds.length > 0) {
      const rows = exerciseIds.map((exId) => ({
        id: `${userId}_${exId}`,
        user_id: userId,
        exercise_id: exId,
        created_at: new Date().toISOString(),
      }));
      await supabase.from('user_favorites').upsert(rows);
    }
  } catch (err) {
    console.warn('Erreur sync favoris cloud:', err);
  }
}

export async function fetchFavoritesFromCloud(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const userId = await getActiveUserId();
    const { data, error } = await supabase
      .from('user_favorites')
      .select('exercise_id')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((r: any) => r.exercise_id);
  } catch {
    return [];
  }
}

// =========================================================================
// 3. SYNCHRONISATION DU POIDS & OBJECTIFS
// =========================================================================

export async function syncBodyWeightsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const userId = session.userId;
    await ensureCloudProfileExists(userId);
    const db = await getDatabase();
    const deletedIds = await getDeletedIdsSet();
    const allWeights = await db.getAllAsync<BodyWeightLog>(
      'SELECT * FROM body_weights ORDER BY date ASC, created_at ASC'
    );
    const weights = (allWeights || []).filter((w) => !deletedIds.has(w.id));

    // 1. Sauvegarde fiable dans la table trades (même si vide après suppression)
    const backupId = `body_weights_${userId}`;
    const { error: backupErr } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { weights },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    if (backupErr) {
      console.warn('Erreur sauvegarde cloud poids (backup):', backupErr.message);
    }

    // 2. Écriture groupée (batch upsert) vers la table native body_weights
    if (weights.length > 0) {
      const nowIso = new Date().toISOString();
      const rows = weights.map((w) => ({
        id: w.id,
        user_id: userId,
        weight: w.weight,
        date: w.date,
        notes: w.note || '',
        created_at: w.created_at || nowIso,
      }));
      try {
        await supabase.from('body_weights').upsert(rows);
      } catch {}
    }

    return !backupErr;
  } catch (err) {
    console.warn('Erreur syncBodyWeightsToCloud:', err);
    return false;
  }
}

export async function deleteWeightLogFromCloud(id: string): Promise<void> {
  await markIdAsDeleted(id);
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('body_weights').delete().eq('id', id);
  } catch {}
  await syncBodyWeightsToCloud();
}

export async function syncBodyWeightToCloud(log: BodyWeightLog): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

    // Tentative d'écriture directe
    try {
      await supabase.from('body_weights').upsert({
        id: log.id,
        user_id: userId,
        weight: log.weight,
        date: log.date,
        notes: log.note || '',
        created_at: log.created_at || new Date().toISOString(),
      });
    } catch {}

    // Sauvegarde complète pour garantir la persistance historique
    await syncBodyWeightsToCloud();
  } catch (err) {
    console.warn('Erreur synchro poids cloud:', err);
  }
}

export async function fetchBodyWeightsFromCloud(): Promise<BodyWeightLog[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();
    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();
    let recoveredWeights: BodyWeightLog[] = [];

    // 1. D'abord tenter depuis la sauvegarde cloud unifiée (contient body_fat_percentage et l'état exact)
    const backupId = `body_weights_${userId}`;
    const { data: backupData, error: backupErr } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (!backupErr && backupData?.offered_pokemon) {
      const weights = (backupData.offered_pokemon as any)?.weights as BodyWeightLog[];
      if (Array.isArray(weights)) {
        recoveredWeights = weights;
      }
    }

    // 2. Compléter avec la table native body_weights si nécessaire
    if (recoveredWeights.length === 0) {
      const { data, error } = await supabase
        .from('body_weights')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1000);

      if (!error && data && data.length > 0) {
        recoveredWeights = data.map((r: any) => ({
          id: r.id,
          weight: r.weight,
          date: r.date,
          note: r.notes || r.note,
          body_fat_percentage: r.body_fat_percentage,
          created_at: r.created_at,
        }));
      }
    }

    recoveredWeights = recoveredWeights.filter((w) => w && w.id && !deletedIds.has(w.id));

    // Restaurer dans SQLite local dans une transaction unique
    if (recoveredWeights.length > 0) {
      const nowIso = new Date().toISOString();
      await runInTransaction(db, async () => {
        for (const w of recoveredWeights) {
          await db.runAsync(
            `INSERT INTO body_weights (id, weight, date, note, body_fat_percentage, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               weight = excluded.weight,
               note = COALESCE(excluded.note, body_weights.note),
               body_fat_percentage = COALESCE(excluded.body_fat_percentage, body_weights.body_fat_percentage)`,
            [
              w.id,
              w.weight,
              w.date,
              w.note || null,
              w.body_fat_percentage || null,
              w.created_at || nowIso,
            ]
          );
        }
      });
    }

    return recoveredWeights;
  } catch (err) {
    console.warn('Erreur fetchBodyWeightsFromCloud:', err);
    return [];
  }
}

export async function syncFitnessGoalsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const userId = session.userId;
    await ensureCloudProfileExists(userId);
    const db = await getDatabase();
    const deletedIds = await getDeletedIdsSet();
    const allGoals = await db.getAllAsync<FitnessGoal>(
      'SELECT * FROM fitness_goals ORDER BY created_at DESC'
    );
    const goals = (allGoals || []).filter((g) => !deletedIds.has(g.id));

    // 1. Sauvegarde fiable dans la table trades (même si vide)
    const backupId = `fitness_goals_${userId}`;
    const { error: backupErr } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { goals },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    if (backupErr) {
      console.warn('Erreur sauvegarde cloud objectifs (backup):', backupErr.message);
    }

    // 2. Écriture groupée (batch upsert) vers la table native fitness_goals
    if (goals.length > 0) {
      const nowIso = new Date().toISOString();
      const rows = goals.map((g) => ({
        id: g.id,
        user_id: userId,
        type: g.category,
        target_value: g.target_value,
        current_value: g.current_value,
        deadline: g.target_date,
        completed: g.completed,
        created_at: g.created_at || nowIso,
      }));
      try {
        await supabase.from('fitness_goals').upsert(rows);
      } catch {}
    }

    return !backupErr;
  } catch (err) {
    console.warn('Erreur syncFitnessGoalsToCloud:', err);
    return false;
  }
}

export async function deleteFitnessGoalFromCloud(id: string): Promise<void> {
  await markIdAsDeleted(id);
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await supabase.from('fitness_goals').delete().eq('id', id);
  } catch {}
  await syncFitnessGoalsToCloud();
}

export async function syncFitnessGoalToCloud(goal: FitnessGoal): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

    try {
      await supabase.from('fitness_goals').upsert({
        id: goal.id,
        user_id: userId,
        type: goal.category,
        target_value: goal.target_value,
        current_value: goal.current_value,
        deadline: goal.target_date,
        completed: goal.completed,
        created_at: goal.created_at || new Date().toISOString(),
      });
    } catch {}

    await syncFitnessGoalsToCloud();
  } catch (err) {
    console.warn('Erreur synchro objectif cloud:', err);
  }
}

export async function fetchFitnessGoalsFromCloud(): Promise<FitnessGoal[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();
    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();
    let recoveredGoals: FitnessGoal[] = [];

    // 1. D'abord tenter depuis la sauvegarde cloud complète (conserve title, starting_value, exercise_id, unit)
    const backupId = `fitness_goals_${userId}`;
    const { data: backupData, error: backupErr } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (!backupErr && backupData?.offered_pokemon) {
      const goals = (backupData.offered_pokemon as any)?.goals as FitnessGoal[];
      if (Array.isArray(goals)) {
        recoveredGoals = goals;
      }
    }

    // 2. Repli sur la table native fitness_goals si nécessaire
    if (recoveredGoals.length === 0) {
      const { data, error } = await supabase
        .from('fitness_goals')
        .select('*')
        .eq('user_id', userId)
        .limit(500);

      if (!error && data && data.length > 0) {
        recoveredGoals = data.map((r: any) => ({
          id: r.id,
          title: r.type,
          category: r.type,
          target_value: r.target_value,
          starting_value: 0,
          current_value: r.current_value,
          unit: 'kg',
          target_date: r.deadline,
          completed: r.completed,
          created_at: r.created_at,
        }));
      }
    }

    recoveredGoals = recoveredGoals.filter((g) => g && g.id && !deletedIds.has(g.id));

    // Restaurer dans SQLite local dans une transaction atomique
    if (recoveredGoals.length > 0) {
      const nowIso = new Date().toISOString();
      await runInTransaction(db, async () => {
        for (const g of recoveredGoals) {
          await db.runAsync(
            `INSERT INTO fitness_goals (
               id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               target_value = excluded.target_value,
               completed = MAX(fitness_goals.completed, excluded.completed),
               completed_at = COALESCE(fitness_goals.completed_at, excluded.completed_at),
               current_value = excluded.current_value`,
            [
              g.id,
              g.title,
              g.category,
              g.target_value,
              g.starting_value || 0,
              g.current_value,
              g.unit || 'kg',
              g.target_date || null,
              g.exercise_id || null,
              g.completed ? 1 : 0,
              g.completed_at || null,
              g.created_at || nowIso,
            ]
          );
        }
      });
    }

    return recoveredGoals;
  } catch (err) {
    console.warn('Erreur fetchFitnessGoalsFromCloud:', err);
    return [];
  }
}

// =========================================================================
// 4. SYNCHRONISATION DES COURSES / MARCHES (RUNNING SESSIONS)
// =========================================================================

export async function syncRunningSessionsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const userId = session.userId;
    await ensureCloudProfileExists(userId);
    const db = await getDatabase();
    const deletedIds = await getDeletedIdsSet();
    const allRuns = await db.getAllAsync<RunningSession>(
      'SELECT * FROM running_sessions ORDER BY date DESC, created_at DESC'
    );
    const runs = (allRuns || []).filter((r) => !deletedIds.has(r.id));

    const backupId = `running_sessions_${userId}`;
    const { error } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { running_sessions: runs },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    if (runs.length > 0) {
      const nowIso = new Date().toISOString();
      const rows = runs.map((r) => ({
        id: r.id,
        user_id: userId,
        date: r.date,
        distance_km: r.distance_km,
        duration_seconds: r.duration_seconds,
        pace_seconds_per_km: r.pace_seconds_per_km,
        notes: r.notes || null,
        calories: r.calories || Math.round(r.distance_km * 65),
        created_at: r.created_at || nowIso,
      }));
      try {
        await supabase.from('running_sessions').upsert(rows);
      } catch {}
    }

    if (error) {
      console.warn('Erreur sauvegarde cloud running_sessions:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erreur syncRunningSessionsToCloud:', err);
    return false;
  }
}

export async function deleteRunningSessionFromCloud(id: string): Promise<void> {
  await markIdAsDeleted(id);
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('running_sessions').delete().eq('id', id);
      } catch {}
    }
  }
  await syncRunningSessionsToCloud();
}

export async function fetchRunningSessionsFromCloud(): Promise<RunningSession[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();
    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();
    let rawRuns: RunningSession[] = [];

    const backupId = `running_sessions_${userId}`;
    const { data, error } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (!error && data?.offered_pokemon) {
      const backupRuns = (data.offered_pokemon as any)?.running_sessions as RunningSession[];
      if (Array.isArray(backupRuns)) {
        rawRuns = backupRuns;
      }
    }

    if (rawRuns.length === 0) {
      try {
        const { data: nativeRuns } = await supabase
          .from('running_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(500);
        if (nativeRuns && nativeRuns.length > 0) {
          rawRuns = nativeRuns.map((r: any) => ({
            id: r.id,
            date: r.date,
            distance_km: r.distance_km,
            duration_seconds: r.duration_seconds,
            pace_seconds_per_km: r.pace_seconds_per_km,
            notes: r.notes,
            calories: r.calories,
            created_at: r.created_at,
          }));
        }
      } catch {}
    }

    const runs = rawRuns.filter((r) => r && r.id && !deletedIds.has(r.id));
    if (runs.length > 0) {
      const nowIso = new Date().toISOString();
      await runInTransaction(db, async () => {
        for (const r of runs) {
          await db.runAsync(
            `INSERT INTO running_sessions (
               id, date, distance_km, duration_seconds, pace_seconds_per_km, notes, calories, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               distance_km = MAX(running_sessions.distance_km, excluded.distance_km),
               duration_seconds = MAX(running_sessions.duration_seconds, excluded.duration_seconds),
               notes = COALESCE(excluded.notes, running_sessions.notes)`,
            [
              r.id,
              r.date,
              r.distance_km,
              r.duration_seconds,
              r.pace_seconds_per_km,
              r.notes || null,
              r.calories || Math.round(r.distance_km * 65),
              r.created_at || nowIso,
            ]
          );
        }
      });
    }

    return runs;
  } catch (err) {
    console.warn('Erreur fetchRunningSessionsFromCloud:', err);
    return [];
  }
}

// =========================================================================
// 5. SYNCHRONISATION DES PROGRAMMES & EXERCICES PERSONNALISÉS
// =========================================================================

export async function syncCustomCatalogToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const userId = session.userId;
    const db = await getDatabase();
    const deletedIds = await getDeletedIdsSet();

    const customExercises = (
      await db.getAllAsync<Exercise>('SELECT * FROM exercises WHERE is_custom = 1')
    ).filter((e) => !deletedIds.has(e.id));

    const customPrograms = (
      await db.getAllAsync<Program>('SELECT * FROM programs WHERE is_custom = 1')
    ).filter((p) => !deletedIds.has(p.id));

    const customProgramExercises = await db.getAllAsync<any>(
      `SELECT pe.* FROM program_exercises pe
       JOIN programs p ON p.id = pe.program_id
       WHERE p.is_custom = 1`
    );

    const backupId = `custom_catalog_${userId}`;
    const { error } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: {
        custom_exercises: customExercises,
        custom_programs: customPrograms,
        custom_program_exercises: customProgramExercises,
      },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch (err) {
    console.warn('Erreur syncCustomCatalogToCloud:', err);
    return false;
  }
}

export async function deleteCustomEntityFromCloud(id: string): Promise<void> {
  await markIdAsDeleted(id);
  await syncCustomCatalogToCloud();
}

export async function fetchCustomCatalogFromCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();
    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();

    const backupId = `custom_catalog_${userId}`;
    const { data, error } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (error || !data?.offered_pokemon) return;
    const payload = data.offered_pokemon as any;

    const customExercises: Exercise[] = Array.isArray(payload.custom_exercises)
      ? payload.custom_exercises.filter((e: any) => e?.id && !deletedIds.has(e.id))
      : [];
    const customPrograms: Program[] = Array.isArray(payload.custom_programs)
      ? payload.custom_programs.filter((p: any) => p?.id && !deletedIds.has(p.id))
      : [];
    const customProgramExercises: any[] = Array.isArray(payload.custom_program_exercises)
      ? payload.custom_program_exercises.filter(
          (pe: any) => pe?.id && pe?.program_id && !deletedIds.has(pe.program_id)
        )
      : [];

    if (
      customExercises.length === 0 &&
      customPrograms.length === 0 &&
      customProgramExercises.length === 0
    ) {
      return;
    }

    const nowIso = new Date().toISOString();
    await runInTransaction(db, async () => {
      for (const ex of customExercises) {
        await db.runAsync(
          `INSERT OR REPLACE INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [ex.id, ex.name, ex.description || '', ex.target_muscle, ex.equipment_needed]
        );
      }

      for (const prog of customPrograms) {
        await db.runAsync(
          `INSERT OR REPLACE INTO programs (id, name, description, difficulty_level, is_custom, created_at)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [
            prog.id,
            prog.name,
            prog.description || '',
            prog.difficulty_level || 'Intermédiaire',
            prog.created_at || nowIso,
          ]
        );
      }

      for (const pe of customProgramExercises) {
        await db.runAsync(
          `INSERT OR REPLACE INTO program_exercises (id, program_id, exercise_id, default_sets, default_reps, rest_time_seconds, order_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pe.id,
            pe.program_id,
            pe.exercise_id,
            pe.default_sets || 3,
            pe.default_reps || 10,
            pe.rest_time_seconds || 90,
            pe.order_index || 0,
          ]
        );
      }
    });
  } catch (err) {
    console.warn('Erreur fetchCustomCatalogFromCloud:', err);
  }
}

// =========================================================================
// 6. SYNCHRONISATION DES RÉGLAGES UTILISATEUR & SÉANCE ACTIVE (TEMPS RÉEL)
// =========================================================================

export async function syncUserSettingsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!rawSettings) return false;

    const parsedSettings = JSON.parse(rawSettings);
    const backupId = `user_settings_${session.userId}`;

    const { error } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: session.userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { settings: parsedSettings, updated_at: new Date().toISOString() },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch {
    return false;
  }
}

export async function fetchUserSettingsFromCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    const backupId = `user_settings_${userId}`;
    const { data, error } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (error || !data?.offered_pokemon) return;
    const cloudSettings = (data.offered_pokemon as any)?.settings;
    if (!cloudSettings || typeof cloudSettings !== 'object') return;

    const rawLocal = await AsyncStorage.getItem(SETTINGS_KEY);
    const localSettings = rawLocal ? JSON.parse(rawLocal) : {};

    const merged = {
      ...localSettings,
      ...cloudSettings,
      user_height_cm: cloudSettings.user_height_cm ?? localSettings.user_height_cm,
    };

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      await useSettingsStore.getState().loadSettings();
    } catch {}
  } catch (err) {
    console.warn('Erreur fetchUserSettingsFromCloud:', err);
  }
}

/**
 * Sauvegarde en temps réel le brouillon de la séance active sur Supabase
 * pour ne jamais perdre une séance en cours si l'application est fermée ou quittée.
 */
export async function syncActiveWorkoutDraftToCloud(draftPayload?: any): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    let draft = draftPayload;
    if (draft === undefined) {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT);
      draft = raw ? JSON.parse(raw) : null;
    }

    const backupId = `active_workout_${session.userId}`;
    const { error } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: session.userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: {
        active_workout: draft,
        updated_at: new Date().toISOString(),
      },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    return !error;
  } catch {
    return false;
  }
}

export async function clearActiveWorkoutDraftFromCloud(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_WORKOUT_DRAFT);
  } catch {}
  await syncActiveWorkoutDraftToCloud(null);
}

export async function fetchActiveWorkoutDraftFromCloud(): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const userId = await getActiveUserId();
    const backupId = `active_workout_${userId}`;
    const { data, error } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (error || !data?.offered_pokemon) return null;
    const activeWorkout = (data.offered_pokemon as any)?.active_workout;
    if (activeWorkout && activeWorkout.isActive && activeWorkout.sessionId) {
      return activeWorkout;
    }
    return null;
  } catch {
    return null;
  }
}

// =========================================================================
// 7. SYNCHRONISATION GLOBALE CLOUD -> LOCAL
// =========================================================================

/**
 * Synchronisation complète depuis Supabase vers la base locale SQLite et AsyncStorage.
 * Rapatrie l'historique de séances, séries, poids, objectifs, courses, programmes perso, réglages et favoris.
 */
export async function fullCloudSyncToLocal(): Promise<{
  sessionsCount: number;
  weightsCount: number;
  goalsCount: number;
  favoritesCount: number;
  eggsCount: number;
}> {
  if (!isSupabaseConfigured()) {
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0, eggsCount: 0 };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0, eggsCount: 0 };
  }

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();

    // 0. Synchroniser les identifiants supprimés (tombstones) et purger localement
    const deletedIds = await fetchAndMergeDeletedIdsFromCloud();
    if (deletedIds.size > 0) {
      await runInTransaction(db, async () => {
        for (const delId of deletedIds) {
          await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [delId]).catch(() => {});
          await db.runAsync('DELETE FROM body_weights WHERE id = ?', [delId]).catch(() => {});
          await db.runAsync('DELETE FROM fitness_goals WHERE id = ?', [delId]).catch(() => {});
          await db.runAsync('DELETE FROM running_sessions WHERE id = ?', [delId]).catch(() => {});
        }
      });
    }

    // 1. Récupérer le catalogue personnalisé (exercices et programmes perso) avant les séances
    await fetchCustomCatalogFromCloud();

    // 2. Récupérer les séances cloud
    const { data: cloudSessions, error: sessErr } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .limit(5000);

    if (sessErr) {
      console.warn('Erreur Supabase fullCloudSyncToLocal sessions:', sessErr.message);
    }

    const filteredSessions = (cloudSessions || []).filter(
      (r: any) =>
        r &&
        r.id &&
        !deletedIds.has(r.id) &&
        (r.completed === 1 ||
          r.completed === true ||
          r.completed === '1' ||
          r.completed === undefined ||
          r.completed === null)
    );

    let sessionsCount = 0;
    if (filteredSessions.length > 0) {
      sessionsCount = filteredSessions.length;
      await runInTransaction(db, async () => {
        for (const s of filteredSessions) {
          await db.runAsync(
            `INSERT INTO workout_sessions (
               id, program_id, program_name, date, duration_seconds, notes, total_volume, total_sets, completed
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET
               duration_seconds = MAX(workout_sessions.duration_seconds, excluded.duration_seconds),
               total_volume = MAX(workout_sessions.total_volume, excluded.total_volume),
               total_sets = MAX(workout_sessions.total_sets, excluded.total_sets),
               notes = COALESCE(workout_sessions.notes, excluded.notes),
               completed = 1`,
            [
              s.id,
              s.program_id,
              s.program_name,
              s.date,
              s.duration_seconds || 0,
              s.notes || null,
              s.total_volume || 0,
              s.total_sets || 0,
            ]
          );
        }
      });

      // Récupérer toutes les séries de cet utilisateur (jusqu'à 10000)
      const { data: cloudSets, error: setsErr } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('user_id', userId)
        .limit(10000);

      if (setsErr) {
        console.warn('Erreur Supabase fullCloudSyncToLocal sets:', setsErr.message);
      }

      if (cloudSets && cloudSets.length > 0) {
        await runInTransaction(db, async () => {
          for (const set of cloudSets) {
            if (deletedIds.has(set.workout_session_id)) continue;
            const isSetDone =
              set.completed === 1 ||
              set.completed === true ||
              set.completed === '1' ||
              set.completed === undefined ||
              set.completed === null;

            await db.runAsync(
              `INSERT INTO workout_sets (
                 id, workout_session_id, exercise_id, set_order, weight, reps, completed, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 weight = MAX(workout_sets.weight, excluded.weight),
                 reps = MAX(workout_sets.reps, excluded.reps),
                 completed = MAX(workout_sets.completed, excluded.completed)`,
              [
                set.id,
                set.workout_session_id,
                set.exercise_id,
                set.set_order,
                set.weight || 0,
                set.reps || 0,
                isSetDone ? 1 : 0,
                set.created_at || new Date().toISOString(),
              ]
            );
          }
        });
      }
    }

    // 3. Récupérer les favoris
    const cloudFavorites = await fetchFavoritesFromCloud();
    if (cloudFavorites.length > 0) {
      await AsyncStorage.setItem('@vitax_favorite_exercise_ids', JSON.stringify(cloudFavorites));
      try {
        const now = new Date().toISOString();
        await runInTransaction(db, async () => {
          for (const exId of cloudFavorites) {
            await db.runAsync(
              'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
              [exId, now]
            );
          }
        });
      } catch {}
    }

    // 4. Récupérer l'ensemble des poids historisés
    const cloudWeights = await fetchBodyWeightsFromCloud();
    const weightsCount = cloudWeights.length;

    // 5. Récupérer l'ensemble des objectifs
    const cloudGoals = await fetchFitnessGoalsFromCloud();
    const goalsCount = cloudGoals.length;

    // 6. Récupérer les séances de course / marche
    await fetchRunningSessionsFromCloud();

    // 7. Récupérer les réglages utilisateur
    await fetchUserSettingsFromCloud();

    // 8. Récupérer les Pokémon et œufs du Cloud
    const eggsCount = await fetchPokemonEggsFromCloud();

    // 9. Récupérer la série journalière (streak) et les bonus depuis le Cloud
    try {
      const backupId = `daily_bonus_${userId}`;
      const { data: bonusData } = await supabase
        .from('trades')
        .select('offered_pokemon')
        .eq('id', backupId)
        .maybeSingle();

      if (bonusData?.offered_pokemon) {
        const cloudBonus = (bonusData.offered_pokemon as any)?.daily_bonus;
        if (cloudBonus) {
          const rawLocalBonus = await AsyncStorage.getItem(STORAGE_KEY_DAILY_BONUS);
          let finalBonus = cloudBonus;
          if (rawLocalBonus) {
            const localBonus = JSON.parse(rawLocalBonus);
            finalBonus = {
              lastClaimDate: cloudBonus.lastClaimDate || localBonus.lastClaimDate,
              currentStreak: Math.max(cloudBonus.currentStreak || 0, localBonus.currentStreak || 0),
              totalBonusesEarned: Math.max(
                cloudBonus.totalBonusesEarned || 0,
                localBonus.totalBonusesEarned || 0
              ),
            };
          }
          await AsyncStorage.setItem(STORAGE_KEY_DAILY_BONUS, JSON.stringify(finalBonus));
        }
      }
    } catch (bErr) {
      console.warn('Erreur sync daily bonus dans fullCloudSyncToLocal:', bErr);
    }

    // 10. Rapatrier le profil athlète Supabase (XP totale, séances et ligue)
    try {
      const profile = await getOrCreateTrainerProfile();
      const { data: cloudProfile } = await supabase
        .from('profiles')
        .select('total_xp, total_workouts, current_league')
        .eq('id', userId)
        .maybeSingle();

      if (cloudProfile) {
        let changed = false;
        if ((cloudProfile.total_xp || 0) > (profile.totalXp || 0)) {
          profile.totalXp = cloudProfile.total_xp;
          changed = true;
        }
        if ((cloudProfile.total_workouts || 0) > (profile.totalWorkouts || 0)) {
          profile.totalWorkouts = cloudProfile.total_workouts;
          changed = true;
        }
        if (cloudProfile.current_league && cloudProfile.current_league !== profile.currentLeague) {
          profile.currentLeague = cloudProfile.current_league;
          changed = true;
        }
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
        }
      }
    } catch (pErr) {
      console.warn('Erreur sync profil dans fullCloudSyncToLocal:', pErr);
    }

    return {
      sessionsCount,
      weightsCount,
      goalsCount,
      favoritesCount: cloudFavorites.length,
      eggsCount,
    };
  } catch (err) {
    console.warn('Erreur fullCloudSyncToLocal:', err);
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0, eggsCount: 0 };
  }
}

/**
 * Sauvegarde l'inventaire complet des œufs et Pokémon éclos dans le cloud
 */
export async function syncPokemonEggsToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return false;

    const db = await getDatabase();
    const eggs = await db.getAllAsync<PokemonEgg>(
      'SELECT * FROM pokemon_eggs ORDER BY obtained_at ASC'
    );

    if (!eggs || eggs.length === 0) return false;

    // 1. Écriture dans la table dédiée pokemon_eggs si disponible
    try {
      const rows = eggs.map((e) => ({
        id: e.id,
        user_id: session.userId,
        name: e.name,
        rarity: e.rarity,
        required_xp: e.required_xp,
        current_xp: e.current_xp || 0,
        status: e.status,
        incubator_slot: e.incubator_slot ?? null,
        obtained_from: e.obtained_from,
        obtained_at: e.obtained_at,
        hatched_at: e.hatched_at ?? null,
        pokemon_id: e.pokemon_id ?? null,
        pokemon_name: e.pokemon_name ?? null,
        pokemon_emoji: e.pokemon_emoji ?? null,
        pokemon_type: e.pokemon_type ?? null,
        pokemon_cp: e.pokemon_cp ?? null,
        is_legendary: e.is_legendary ? 1 : 0,
        current_pokemon_xp: e.current_pokemon_xp || 0,
      }));
      await supabase.from('pokemon_eggs').upsert(rows, { onConflict: 'id' });
    } catch {}

    // 2. Sauvegarde miroir dans trades pour compatibilité
    const backupId = `pokemon_inventory_${session.userId}`;
    const { error } = await supabase.from('trades').upsert({
      id: backupId,
      sender_id: session.userId,
      sender_name: session.username || 'Athlète Vitax',
      sender_code: session.friendCode || '00000',
      offered_pokemon: { eggs },
      status: 'cloud_backup',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Erreur sauvegarde cloud Pokémon:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Exception sauvegarde cloud Pokémon:', e);
    return false;
  }
}

/**
 * Restaure l'inventaire des œufs et Pokémon éclos depuis le cloud vers SQLite local
 */
export async function fetchPokemonEggsFromCloud(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) return 0;

    let eggs: PokemonEgg[] = [];

    // 1. Lecture prioritaire depuis la table dédiée pokemon_eggs
    try {
      const { data: tableEggs, error: tableErr } = await supabase
        .from('pokemon_eggs')
        .select('*')
        .eq('user_id', session.userId);
      if (!tableErr && Array.isArray(tableEggs) && tableEggs.length > 0) {
        eggs = tableEggs as PokemonEgg[];
      }
    } catch {}

    // 2. Repli sur le backup trades
    if (eggs.length === 0) {
      const backupId = `pokemon_inventory_${session.userId}`;
      const { data, error } = await supabase
        .from('trades')
        .select('offered_pokemon')
        .eq('id', backupId)
        .maybeSingle();

      if (!error && data?.offered_pokemon) {
        const backupEggs = (data.offered_pokemon as any)?.eggs as PokemonEgg[];
        if (Array.isArray(backupEggs)) {
          eggs = backupEggs;
        }
      }
    }

    if (eggs.length === 0) return 0;

    const db = await getDatabase();
    const localEggs = await db.getAllAsync<PokemonEgg>('SELECT * FROM pokemon_eggs');
    const localMap = new Map(localEggs.map((e) => [e.id, e]));

    let maxSlotFound = 1;

    await runInTransaction(db, async () => {
      for (const egg of eggs) {
        const local = localMap.get(egg.id);

        let finalStatus = egg.status;
        let finalSlot = egg.incubator_slot;
        let finalHatchedAt = egg.hatched_at || local?.hatched_at || null;

        if (local?.status === 'hatched' || egg.status === 'hatched') {
          finalStatus = 'hatched';
          finalSlot = null;
          if (!finalHatchedAt) finalHatchedAt = new Date().toISOString();
        } else if (local?.status === 'incubating') {
          finalStatus = 'incubating';
          finalSlot = local.incubator_slot ?? egg.incubator_slot ?? 1;
        } else if (egg.status === 'incubating') {
          finalStatus = 'incubating';
          finalSlot = egg.incubator_slot ?? local?.incubator_slot ?? 1;
        }

        if (finalSlot && finalSlot > maxSlotFound) {
          maxSlotFound = finalSlot;
        }

        const finalXp = Math.max(local?.current_xp || 0, egg.current_xp || 0);
        const finalPokemonXp = Math.max(egg.current_pokemon_xp || 0, local?.current_pokemon_xp || 0);

        await db.runAsync(
          `INSERT OR REPLACE INTO pokemon_eggs (
            id, name, rarity, required_xp, current_xp, status, incubator_slot,
            obtained_from, obtained_at, hatched_at, pokemon_id, pokemon_name,
            pokemon_emoji, pokemon_type, pokemon_cp, is_legendary, current_pokemon_xp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            egg.id,
            egg.name,
            egg.rarity,
            egg.required_xp,
            finalXp,
            finalStatus,
            finalSlot,
            egg.obtained_from,
            egg.obtained_at,
            finalHatchedAt,
            egg.pokemon_id || local?.pokemon_id || null,
            egg.pokemon_name || local?.pokemon_name || null,
            egg.pokemon_emoji || local?.pokemon_emoji || null,
            egg.pokemon_type || local?.pokemon_type || null,
            egg.pokemon_cp || local?.pokemon_cp || null,
            egg.is_legendary ? 1 : 0,
            finalPokemonXp,
          ]
        );
      }
    });

    if (maxSlotFound > 1) {
      try {
        const rawMax = await AsyncStorage.getItem('@vitax_max_unlocked_incubator');
        const currMax = rawMax ? parseInt(rawMax, 10) : 1;
        if (maxSlotFound > currMax) {
          await AsyncStorage.setItem('@vitax_max_unlocked_incubator', String(maxSlotFound));
        }
      } catch {}
    }

    void syncPokemonEggsToCloud();

    return eggs.length;
  } catch (e) {
    console.warn('Exception restauration cloud Pokémon:', e);
    return 0;
  }
}

let pushLocalToCloudPromise: Promise<void> | null = null;

/**
 * Envoie toutes les données locales vers Supabase en temps réel (avec verrou anti-concurrence)
 */
export async function pushLocalToCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (pushLocalToCloudPromise) {
    return pushLocalToCloudPromise;
  }

  pushLocalToCloudPromise = (async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const session = await getPersistedSession();
      if (!session?.isLoggedIn || !session.userId) {
        return;
      }

      const db = await getDatabase();
      const deletedIds = await fetchAndMergeDeletedIdsFromCloud();

      // 0. Synchroniser les suppressions (tombstones)
      await syncDeletedIdsToCloud(Array.from(deletedIds));

      // 1. Envoyer les séances locales non supprimées en batch (évite le N+1 sur tout l'historique)
      const localSessions = await db.getAllAsync<WorkoutSession>(
        "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
      );
      const validSessions = localSessions.filter((s) => !deletedIds.has(s.id));

      if (validSessions.length > 0) {
        const { data: existingCloudSessions } = await supabase
          .from('workout_sessions')
          .select('id, total_sets, total_volume, duration_seconds')
          .eq('user_id', session.userId);

        const cloudMap = new Map(
          (existingCloudSessions || []).map((cs: any) => [cs.id, cs])
        );

        const sessionsToSync = validSessions.filter((s) => {
          const cs = cloudMap.get(s.id);
          if (!cs) return true;
          return (
            (s.total_sets || 0) > (cs.total_sets || 0) ||
            (s.total_volume || 0) > (cs.total_volume || 0) ||
            (s.duration_seconds || 0) > (cs.duration_seconds || 0)
          );
        });

        if (sessionsToSync.length > 0) {
          const sessionPayloads = sessionsToSync.map((s) => ({
            id: s.id,
            user_id: session.userId,
            program_id: s.program_id,
            program_name: s.program_name,
            date: s.date,
            duration_seconds: s.duration_seconds,
            notes: s.notes || null,
            total_volume: s.total_volume,
            total_sets: s.total_sets,
            completed: 1,
          }));

          await supabase
            .from('workout_sessions')
            .upsert(sessionPayloads, { onConflict: 'id' });

          const sessionIds = sessionsToSync.map((s) => s.id);
          const placeholders = sessionIds.map(() => '?').join(', ');
          const allSets = await db.getAllAsync<WorkoutSet>(
            `SELECT * FROM workout_sets WHERE workout_session_id IN (${placeholders}) ORDER BY set_order ASC`,
            sessionIds
          );

          const validSets = allSets.filter(
            (set) =>
              set.completed === 1 ||
              (set.completed as any) === true ||
              (set.completed as any) === '1'
          );

          if (validSets.length > 0) {
            const setPayloads = validSets.map((set) => ({
              id: set.id,
              user_id: session.userId,
              workout_session_id: set.workout_session_id,
              exercise_id: set.exercise_id,
              set_order: set.set_order,
              weight: set.weight,
              reps: set.reps,
              completed: 1,
              created_at: set.created_at,
            }));

            await supabase
              .from('workout_sets')
              .upsert(setPayloads, { onConflict: 'id' });
          }
        }
      }

      // 2. Envoyer les poids locaux
      await syncBodyWeightsToCloud();

      // 3. Envoyer les objectifs locaux
      await syncFitnessGoalsToCloud();

      // 4. Envoyer les séances de course locales
      await syncRunningSessionsToCloud();

      // 5. Envoyer les programmes et exercices personnalisés
      await syncCustomCatalogToCloud();

      // 6. Envoyer les réglages utilisateur et la séance active en cours
      await syncUserSettingsToCloud();
      await syncActiveWorkoutDraftToCloud();

      // 7. Envoyer les favoris locaux
      let favIds: string[] = [];
      try {
        const favRows = await db.getAllAsync<{ exercise_id: string }>(
          'SELECT exercise_id FROM exercise_favorites'
        );
        if (favRows && favRows.length > 0) {
          favIds = favRows.map((r) => r.exercise_id);
        }
      } catch {}

      if (favIds.length === 0) {
        const rawFavs = await AsyncStorage.getItem('@vitax_favorite_exercise_ids');
        if (rawFavs) {
          const parsed = JSON.parse(rawFavs);
          if (Array.isArray(parsed)) favIds = parsed;
        }
      }

      if (favIds.length > 0) {
        await syncFavoritesToCloud(favIds);
      }

      // 8. Envoyer les Pokémon et œufs locaux
      await syncPokemonEggsToCloud();

      // 9. Sauvegarder la série journalière (streak) et les bonus dans le Cloud (avec colonnes valides)
      try {
        const rawBonus = await AsyncStorage.getItem(STORAGE_KEY_DAILY_BONUS);
        if (rawBonus) {
          const bonusState = JSON.parse(rawBonus);
          const backupId = `daily_bonus_${session.userId}`;
          await supabase.from('trades').upsert({
            id: backupId,
            sender_id: session.userId,
            sender_name: session.username || 'Athlète Vitax',
            sender_code: session.friendCode || '00000',
            offered_pokemon: { daily_bonus: bonusState } as any,
            status: 'cloud_backup',
            created_at: new Date().toISOString(),
          });
        }
      } catch (bErr) {
        console.warn('Erreur sync daily bonus dans pushLocalToCloud:', bErr);
      }

      // 10. Synchroniser et consolider le profil athlète (XP totale, séances et ligue)
      try {
        const gStats = await getUserGamificationStats();
        const profile = await getOrCreateTrainerProfile();
        if (gStats && gStats.totalXp > (profile.totalXp || 0)) {
          profile.totalXp = gStats.totalXp;
        }
        if (gStats && gStats.totalSessions > (profile.totalWorkouts || 0)) {
          profile.totalWorkouts = gStats.totalSessions;
        }
        await syncTrainerProfileToSupabase(profile);
      } catch (pErr) {
        console.warn('Erreur sync profil athlète dans pushLocalToCloud:', pErr);
      }
    } catch (err) {
      console.warn('Erreur pushLocalToCloud:', err);
    }
  })().finally(() => {
    pushLocalToCloudPromise = null;
  });

  return pushLocalToCloudPromise;
}

/**
 * Synchronisation bidirectionnelle intelligente :
 * 1. Pousse les données locales vers Supabase
 * 2. Rapatrie les données du Cloud vers le stockage local
 */
export async function syncCloudAndLocal(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await pushLocalToCloud();
    await fullCloudSyncToLocal();
  } catch (err) {
    console.warn('Erreur syncCloudAndLocal:', err);
  }
}

/**
 * Sauvegarde immédiate en temps réel vers Supabase lorsque l'application passe en arrière-plan ou se ferme
 */
export async function flushAllRealtimeToSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await pushLocalToCloud();
  } catch (err) {
    console.warn('Erreur flushAllRealtimeToSupabase:', err);
  }
}

let lifecycleRegistered = false;

/**
 * Enregistre les écouteurs globaux (AppState mobile + visibilitychange/pagehide/online Web)
 * pour garantir que toute fermeture d'application ou reprise réseau enregistre les données sur Supabase en temps réel.
 */
export function registerRealtimeLifecycleSync(): () => void {
  if (lifecycleRegistered) return () => {};
  lifecycleRegistered = true;

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      void flushAllRealtimeToSupabase();
    } else if (nextAppState === 'active') {
      void syncCloudAndLocal();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  let cleanupWeb = () => {};
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void flushAllRealtimeToSupabase();
      } else if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncCloudAndLocal();
      }
    };
    const onPageHide = () => {
      void flushAllRealtimeToSupabase();
    };
    const onOnline = () => {
      void syncCloudAndLocal();
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('online', onOnline);

    cleanupWeb = () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }

  return () => {
    subscription.remove();
    cleanupWeb();
    lifecycleRegistered = false;
  };
}

