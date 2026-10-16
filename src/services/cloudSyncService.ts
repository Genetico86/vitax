import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { WorkoutSession, WorkoutSet, WorkoutSessionWithSets, BodyWeightLog, FitnessGoal, PokemonEgg } from '../types';
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
    const weights = await db.getAllAsync<BodyWeightLog>(
      'SELECT * FROM body_weights ORDER BY date ASC, created_at ASC'
    );

    if (!weights || weights.length === 0) return true;

    // 1. Sauvegarde fiable dans la table trades (RLS désactivé)
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

    // 2. Tentative vers la table native body_weights
    for (const w of weights) {
      try {
        await supabase.from('body_weights').upsert({
          id: w.id,
          user_id: userId,
          weight: w.weight,
          date: w.date,
          notes: w.note || '',
          created_at: w.created_at || new Date().toISOString(),
        });
      } catch {}
    }

    return !backupErr;
  } catch (err) {
    console.warn('Erreur syncBodyWeightsToCloud:', err);
    return false;
  }
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
    let recoveredWeights: BodyWeightLog[] = [];

    // 1. D'abord tenter depuis la table native body_weights
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

    // 2. Si vide (ex: RLS actif), récupérer depuis la sauvegarde cloud
    if (recoveredWeights.length === 0) {
      const backupId = `body_weights_${userId}`;
      const { data: backupData, error: backupErr } = await supabase
        .from('trades')
        .select('offered_pokemon')
        .eq('id', backupId)
        .maybeSingle();

      if (!backupErr && backupData?.offered_pokemon) {
        const weights = (backupData.offered_pokemon as any)?.weights as BodyWeightLog[];
        if (Array.isArray(weights) && weights.length > 0) {
          recoveredWeights = weights;
        }
      }
    }

    // Restaurer dans SQLite local
    if (recoveredWeights.length > 0) {
      for (const w of recoveredWeights) {
        await db.runAsync(
          `INSERT OR REPLACE INTO body_weights (id, weight, date, note, body_fat_percentage, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.weight,
            w.date,
            w.note || null,
            w.body_fat_percentage || null,
            w.created_at || new Date().toISOString(),
          ]
        );
      }
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
    const goals = await db.getAllAsync<FitnessGoal>(
      'SELECT * FROM fitness_goals ORDER BY created_at DESC'
    );

    if (!goals || goals.length === 0) return true;

    // 1. Sauvegarde fiable dans la table trades (RLS désactivé)
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

    // 2. Tentative vers la table native fitness_goals
    for (const g of goals) {
      try {
        await supabase.from('fitness_goals').upsert({
          id: g.id,
          user_id: userId,
          type: g.category,
          target_value: g.target_value,
          current_value: g.current_value,
          deadline: g.target_date,
          completed: g.completed,
          created_at: g.created_at || new Date().toISOString(),
        });
      } catch {}
    }

    return !backupErr;
  } catch (err) {
    console.warn('Erreur syncFitnessGoalsToCloud:', err);
    return false;
  }
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
    let recoveredGoals: FitnessGoal[] = [];

    // 1. D'abord tenter depuis la table native fitness_goals
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

    // 2. Si vide (ex: RLS actif), récupérer depuis la sauvegarde cloud
    if (recoveredGoals.length === 0) {
      const backupId = `fitness_goals_${userId}`;
      const { data: backupData, error: backupErr } = await supabase
        .from('trades')
        .select('offered_pokemon')
        .eq('id', backupId)
        .maybeSingle();

      if (!backupErr && backupData?.offered_pokemon) {
        const goals = (backupData.offered_pokemon as any)?.goals as FitnessGoal[];
        if (Array.isArray(goals) && goals.length > 0) {
          recoveredGoals = goals;
        }
      }
    }

    // Restaurer dans SQLite local
    if (recoveredGoals.length > 0) {
      for (const g of recoveredGoals) {
        await db.runAsync(
          `INSERT OR REPLACE INTO fitness_goals (
             id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'kg', ?, NULL, ?, NULL, ?)`,
          [
            g.id,
            g.title,
            g.category,
            g.target_value,
            g.starting_value || 0,
            g.current_value,
            g.target_date || null,
            g.completed ? 1 : 0,
            g.created_at || new Date().toISOString(),
          ]
        );
      }
    }

    return recoveredGoals;
  } catch (err) {
    console.warn('Erreur fetchFitnessGoalsFromCloud:', err);
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

    // 1. Récupérer les séances cloud
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

    // 3. Récupérer l'ensemble des poids historisés
    const cloudWeights = await fetchBodyWeightsFromCloud();
    const weightsCount = cloudWeights.length;

    // 4. Récupérer l'ensemble des objectifs
    const cloudGoals = await fetchFitnessGoalsFromCloud();
    const goalsCount = cloudGoals.length;

    // 5. Récupérer les Pokémon et œufs du Cloud
    const eggsCount = await fetchPokemonEggsFromCloud();

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
      "SELECT * FROM pokemon_eggs ORDER BY obtained_at ASC"
    );

    if (!eggs || eggs.length === 0) return false;

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

    const backupId = `pokemon_inventory_${session.userId}`;
    const { data, error } = await supabase
      .from('trades')
      .select('offered_pokemon')
      .eq('id', backupId)
      .maybeSingle();

    if (error || !data || !data.offered_pokemon) return 0;

    const eggs = (data.offered_pokemon as any)?.eggs as PokemonEgg[];
    if (!Array.isArray(eggs) || eggs.length === 0) return 0;

    const db = await getDatabase();
    const localEggs = await db.getAllAsync<PokemonEgg>('SELECT * FROM pokemon_eggs');
    const localMap = new Map(localEggs.map((e) => [e.id, e]));

    let maxSlotFound = 1;

    for (const egg of eggs) {
      const local = localMap.get(egg.id);

      // Priorité à l'état actif le plus avancé :
      // 1. Si déjà éclos localement ou dans le cloud, il est 'hatched'
      let finalStatus = egg.status;
      let finalSlot = egg.incubator_slot;
      let finalHatchedAt = egg.hatched_at || local?.hatched_at || null;

      if (local?.status === 'hatched' || egg.status === 'hatched') {
        finalStatus = 'hatched';
        finalSlot = null;
        if (!finalHatchedAt) finalHatchedAt = new Date().toISOString();
      } else if (local?.status === 'incubating') {
        // Si l'œuf est en cours d'incubation localement, NE JAMAIS l'éjecter vers l'inventaire
        finalStatus = 'incubating';
        finalSlot = local.incubator_slot ?? egg.incubator_slot ?? 1;
      } else if (egg.status === 'incubating') {
        finalStatus = 'incubating';
        finalSlot = egg.incubator_slot ?? local?.incubator_slot ?? 1;
      }

      if (finalSlot && finalSlot > maxSlotFound) {
        maxSlotFound = finalSlot;
      }

      // Ne jamais régresser l'XP
      const finalXp = Math.max(local?.current_xp || 0, egg.current_xp || 0);

      await db.runAsync(
        `INSERT OR REPLACE INTO pokemon_eggs (
          id, name, rarity, required_xp, current_xp, status, incubator_slot,
          obtained_from, obtained_at, hatched_at, pokemon_id, pokemon_name,
          pokemon_emoji, pokemon_type, pokemon_cp, is_legendary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ]
      );
    }

    if (maxSlotFound > 1) {
      try {
        const rawMax = await AsyncStorage.getItem('@vitax_max_unlocked_incubator');
        const currMax = rawMax ? parseInt(rawMax, 10) : 1;
        if (maxSlotFound > currMax) {
          await AsyncStorage.setItem('@vitax_max_unlocked_incubator', String(maxSlotFound));
        }
      } catch {}
    }

    // Après fusion locale, synchroniser l'état unifié vers Supabase
    void syncPokemonEggsToCloud();

    return eggs.length;
  } catch (e) {
    console.warn('Exception restauration cloud Pokémon:', e);
    return 0;
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
    const session = await getPersistedSession();
    if (!session?.isLoggedIn || !session.userId) {
      return;
    }

    const db = await getDatabase();

    // 1. Envoyer les séances locales
    const localSessions = await db.getAllAsync<WorkoutSession>(
      "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)"
    );

    for (const s of localSessions) {
      const sets = await db.getAllAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE workout_session_id = ? ORDER BY set_order ASC',
        [s.id]
      );
      await syncWorkoutSessionToCloud(s, sets);
    }

    // 2. Envoyer les poids locaux (sauvegarde cloud complète et résiliente)
    await syncBodyWeightsToCloud();

    // 3. Envoyer les objectifs locaux (sauvegarde cloud complète et résiliente)
    await syncFitnessGoalsToCloud();

    // 4. Envoyer les favoris locaux
    const rawFavs = await AsyncStorage.getItem('@vitax_favorite_exercise_ids');
    if (rawFavs) {
      const favIds = JSON.parse(rawFavs);
      if (Array.isArray(favIds) && favIds.length > 0) {
        await syncFavoritesToCloud(favIds);
      }
    }

    // 5. Envoyer les Pokémon et œufs locaux
    await syncPokemonEggsToCloud();
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

