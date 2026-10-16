import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { WorkoutSession, WorkoutSet, WorkoutSessionWithSets, BodyWeightLog, FitnessGoal } from '../types';
import { getPersistedSession } from './authService';
import { getOrCreateTrainerProfile, syncTrainerProfileToSupabase } from './multiplayerService';
import { getDatabase } from '../database/db';
import seedData from '../database/seedData.json';

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

    const completedRows = data.filter(
      (row: any) =>
        row.completed === 1 ||
        row.completed === true ||
        row.completed === '1' ||
        row.completed === undefined ||
        row.completed === null
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
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
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

export async function syncBodyWeightToCloud(log: BodyWeightLog): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

    await supabase.from('body_weights').upsert({
      id: log.id,
      user_id: userId,
      weight: log.weight,
      date: log.date,
      notes: log.note || '',
      created_at: log.created_at || new Date().toISOString(),
    });
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
    const { data, error } = await supabase
      .from('body_weights')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      weight: r.weight,
      date: r.date,
      note: r.notes,
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function syncFitnessGoalToCloud(goal: FitnessGoal): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    await ensureCloudProfileExists(userId);

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
    const { data, error } = await supabase
      .from('fitness_goals')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((r: any) => ({
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
  } catch {
    return [];
  }
}

// =========================================================================
// 4. SYNCHRONISATION GLOBALE CLOUD -> LOCAL
// =========================================================================

/**
 * Synchronisation complète depuis Supabase vers la base locale SQLite et AsyncStorage.
 * Rapatrie l'historique de séances, séries, poids, objectifs et favoris.
 */
export async function fullCloudSyncToLocal(): Promise<{
  sessionsCount: number;
  weightsCount: number;
  goalsCount: number;
  favoritesCount: number;
}> {
  if (!isSupabaseConfigured()) {
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0 };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0 };
  }

  try {
    const userId = await getActiveUserId();
    const db = await getDatabase();

    // 1. Récupérer les séances cloud
    const { data: cloudSessions, error: sessErr } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId);

    if (sessErr) {
      console.warn('Erreur Supabase fullCloudSyncToLocal sessions:', sessErr.message);
    }

    const filteredSessions = (cloudSessions || []).filter(
      (r: any) =>
        r.completed === 1 ||
        r.completed === true ||
        r.completed === '1' ||
        r.completed === undefined ||
        r.completed === null
    );

    let sessionsCount = 0;
    if (filteredSessions.length > 0) {
      sessionsCount = filteredSessions.length;
      for (const s of filteredSessions) {
        await db.runAsync(
          `INSERT OR REPLACE INTO workout_sessions (
             id, program_id, program_name, date, duration_seconds, notes, total_volume, total_sets, completed
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.program_id,
            s.program_name,
            s.date,
            s.duration_seconds || 0,
            s.notes || null,
            s.total_volume || 0,
            s.total_sets || 0,
            1,
          ]
        );
      }

      // Récupérer toutes les séries de cet utilisateur
      const { data: cloudSets, error: setsErr } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('user_id', userId);

      if (setsErr) {
        console.warn('Erreur Supabase fullCloudSyncToLocal sets:', setsErr.message);
      }

      if (cloudSets && cloudSets.length > 0) {
        for (const set of cloudSets) {
          const isSetDone =
            set.completed === 1 ||
            set.completed === true ||
            set.completed === '1' ||
            set.completed === undefined ||
            set.completed === null;

          await db.runAsync(
            `INSERT OR REPLACE INTO workout_sets (
               id, workout_session_id, exercise_id, set_order, weight, reps, completed, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      }
    }

    // 2. Récupérer les favoris
    const cloudFavorites = await fetchFavoritesFromCloud();
    if (cloudFavorites.length > 0) {
      await AsyncStorage.setItem('@vitax_favorite_exercise_ids', JSON.stringify(cloudFavorites));
    }

    // 3. Récupérer les poids
    const { data: cloudWeights } = await supabase
      .from('body_weights')
      .select('*')
      .eq('user_id', userId);

    let weightsCount = 0;
    if (cloudWeights && cloudWeights.length > 0) {
      weightsCount = cloudWeights.length;
      for (const w of cloudWeights) {
        await db.runAsync(
          `INSERT OR REPLACE INTO body_weights (id, weight, date, note, body_fat_percentage, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.weight,
            w.date,
            w.notes || null,
            null,
            w.created_at || new Date().toISOString(),
          ]
        );
      }
    }

    // 4. Récupérer les objectifs
    const { data: cloudGoals } = await supabase
      .from('fitness_goals')
      .select('*')
      .eq('user_id', userId);

    let goalsCount = 0;
    if (cloudGoals && cloudGoals.length > 0) {
      goalsCount = cloudGoals.length;
      for (const g of cloudGoals) {
        await db.runAsync(
          `INSERT OR REPLACE INTO fitness_goals (
             id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'kg', ?, NULL, ?, NULL, ?)`,
          [
            g.id,
            g.type,
            g.type === 'weight' ? 'weight' : 'exercise_pr',
            g.target_value,
            0,
            g.current_value,
            g.deadline || null,
            g.completed ? 1 : 0,
            g.created_at || new Date().toISOString(),
          ]
        );
      }
    }

    return {
      sessionsCount,
      weightsCount,
      goalsCount,
      favoritesCount: cloudFavorites.length,
    };
  } catch (err) {
    console.warn('Erreur fullCloudSyncToLocal:', err);
    return { sessionsCount: 0, weightsCount: 0, goalsCount: 0, favoritesCount: 0 };
  }
}

/**
 * Envoie toutes les données locales vers Supabase
 * Permet de synchroniser les séances déjà enregistrées sur le téléphone vers la base partagée
 */
export async function pushLocalToCloud(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const userId = await getActiveUserId();
    if (!userId || userId === 'default_trainer' || userId.startsWith('trainer_')) {
      return;
    }

    const db = await getDatabase();

    // 1. Envoyer les séances locales
    const localSessions = await db.getAllAsync<WorkoutSession>(
      'SELECT * FROM workout_sessions WHERE completed = 1'
    );

    for (const session of localSessions) {
      const sets = await db.getAllAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE workout_session_id = ? ORDER BY set_order ASC',
        [session.id]
      );
      await syncWorkoutSessionToCloud(session, sets);
    }

    // 2. Envoyer les poids locaux
    const localWeights = await db.getAllAsync<BodyWeightLog>(
      'SELECT * FROM body_weights ORDER BY date DESC'
    );
    for (const w of localWeights) {
      await syncBodyWeightToCloud(w);
    }

    // 3. Envoyer les objectifs locaux
    const localGoals = await db.getAllAsync<FitnessGoal>(
      'SELECT * FROM fitness_goals'
    );
    for (const g of localGoals) {
      await syncFitnessGoalToCloud(g);
    }

    // 4. Envoyer les favoris locaux
    const rawFavs = await AsyncStorage.getItem('@vitax_favorite_exercise_ids');
    if (rawFavs) {
      const favIds = JSON.parse(rawFavs);
      if (Array.isArray(favIds) && favIds.length > 0) {
        await syncFavoritesToCloud(favIds);
      }
    }
  } catch (err) {
    console.warn('Erreur pushLocalToCloud:', err);
  }
}

/**
 * Synchronisation bidirectionnelle intelligente :
 * 1. Pousse d'abord les données locales vers Supabase (sauvegarde de l'historique du téléphone)
 * 2. Rapatrie ensuite les données du Cloud vers le stockage local (synchronisation avec le web)
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

