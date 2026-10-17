import { getDatabase } from './db';
import { Exercise, ExerciseHistoryPoint } from '../types';

export async function getAllExercises(muscleFilter?: string): Promise<Exercise[]> {
  const db = await getDatabase();
  if (muscleFilter && muscleFilter !== 'Tous') {
    return await db.getAllAsync<Exercise>(
      'SELECT * FROM exercises WHERE target_muscle = ? ORDER BY name ASC',
      [muscleFilter]
    );
  }
  return await db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name ASC');
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
  return row || null;
}

export async function createCustomExercise(
  exercise: Omit<Exercise, 'id' | 'is_custom'>
): Promise<Exercise> {
  const db = await getDatabase();
  const id = `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.runAsync(
    `INSERT INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, exercise.name, exercise.description, exercise.target_muscle, exercise.equipment_needed]
  );
  try {
    const { syncCustomCatalogToCloud } = await import('../services/cloudSyncService');
    void syncCustomCatalogToCloud();
  } catch {}
  return {
    id,
    ...exercise,
    is_custom: 1,
  };
}

export async function deleteCustomExercise(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
  if (result.changes > 0) {
    try {
      const { deleteCustomEntityFromCloud } = await import('../services/cloudSyncService');
      void deleteCustomEntityFromCloud(id);
    } catch {}
  }
  return result.changes > 0;
}

/**
 * Récupère la dernière série validée pour un exercice spécifique afin de pré-remplir la séance suivante
 */
export async function getLastPerformanceForExercise(
  exerciseId: string
): Promise<{ weight: number; reps: number } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ weight: number; reps: number }>(
    `SELECT ws.weight, ws.reps
     FROM workout_sets ws
     JOIN workout_sessions s ON s.id = ws.workout_session_id
     WHERE ws.exercise_id = ? AND (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
     ORDER BY s.date DESC, ws.set_order DESC
     LIMIT 1`,
    [exerciseId]
  );
  return row || null;
}

/**
 * Récupère en une seule requête SQL les dernières performances pour une liste d'exercices
 * (évite les requêtes N+1 au démarrage d'un programme ou d'une séance ciblée)
 */
export async function getLastPerformanceForExercises(
  exerciseIds: string[]
): Promise<Map<string, { weight: number; reps: number }>> {
  const result = new Map<string, { weight: number; reps: number }>();
  if (!exerciseIds || exerciseIds.length === 0) return result;

  const uniqueIds = Array.from(new Set(exerciseIds));
  const db = await getDatabase();
  const placeholders = uniqueIds.map(() => '?').join(',');

  const rows = await db.getAllAsync<{
    exercise_id: string;
    weight: number;
    reps: number;
  }>(
    `SELECT ws.exercise_id, ws.weight, ws.reps
     FROM workout_sets ws
     JOIN workout_sessions s ON s.id = ws.workout_session_id
     WHERE ws.exercise_id IN (${placeholders})
       AND (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
     ORDER BY s.date DESC, ws.set_order DESC`,
    uniqueIds
  );

  for (const row of rows) {
    if (!result.has(row.exercise_id)) {
      result.set(row.exercise_id, { weight: row.weight, reps: row.reps });
    }
  }

  return result;
}

/**
 * Récupère l'historique d'un exercice pour tracer la courbe de progression et le 1RM
 */
export async function getExerciseProgression(
  exerciseId: string
): Promise<ExerciseHistoryPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    session_id: string;
    date: string;
    weight: number;
    reps: number;
  }>(
    `SELECT
       s.id AS session_id,
       s.date,
       ws.weight,
       ws.reps
     FROM workout_sets ws
     JOIN workout_sessions s ON s.id = ws.workout_session_id
     WHERE ws.exercise_id = ? AND (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
     ORDER BY s.date ASC`,
    [exerciseId]
  );

  // Regrouper par séance d'entraînement
  const sessionMap = new Map<
    string,
    {
      date: string;
      max_weight: number;
      max_reps: number;
      total_volume: number;
      best_1rm: number;
    }
  >();

  for (const row of rows) {
    const w = row.weight ?? 0;
    const r = row.reps ?? 0;
    const est1rm = w > 0 ? Math.round(w * (1 + (r || 1) / 30) * 10) / 10 : 0;
    const vol = w * r;

    const existing = sessionMap.get(row.session_id);
    if (!existing) {
      sessionMap.set(row.session_id, {
        date: row.date,
        max_weight: w,
        max_reps: r,
        total_volume: vol,
        best_1rm: est1rm,
      });
    } else {
      existing.max_weight = Math.max(existing.max_weight, w);
      existing.max_reps = Math.max(existing.max_reps, r);
      existing.total_volume += vol;
      existing.best_1rm = Math.max(existing.best_1rm, est1rm);
    }
  }

  return Array.from(sessionMap.values()).map((item) => ({
    date: item.date,
    max_weight: item.max_weight,
    max_reps: item.max_reps,
    total_volume: item.total_volume,
    estimated_1rm: item.best_1rm,
  }));
}

