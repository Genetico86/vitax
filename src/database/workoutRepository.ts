import { getDatabase } from './db';
import { WorkoutSession, WorkoutSet, WorkoutSessionWithSets, WorkoutSetDetail } from '../types';

export async function saveWorkoutSession(
  session: WorkoutSession,
  sets: WorkoutSet[]
): Promise<void> {
  const db = await getDatabase();

  // Calcul du volume total et du nombre de séries
  const totalVolume = sets
    .filter((s) => s.completed === 1)
    .reduce((acc, curr) => acc + curr.weight * curr.reps, 0);

  const completedSetsCount = sets.filter((s) => s.completed === 1).length;

  await db.runAsync(
    `INSERT OR REPLACE INTO workout_sessions (
       id, program_id, program_name, date, duration_seconds, notes, total_volume, total_sets, completed
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.program_id,
      session.program_name,
      session.date,
      session.duration_seconds,
      session.notes,
      totalVolume,
      completedSetsCount,
      session.completed,
    ]
  );

  // Supprimer les séries précédentes s'il s'agit d'une mise à jour
  await db.runAsync('DELETE FROM workout_sets WHERE workout_session_id = ?', [session.id]);

  // Insérer chaque série
  const now = new Date().toISOString();
  for (const s of sets) {
    await db.runAsync(
      `INSERT INTO workout_sets (
         id, workout_session_id, exercise_id, set_order, weight, reps, completed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        session.id,
        s.exercise_id,
        s.set_order,
        s.weight,
        s.reps,
        s.completed,
        s.created_at || now,
      ]
    );
  }
}

export async function getAllWorkoutSessions(): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  return await db.getAllAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE completed = 1 ORDER BY date DESC'
  );
}

export async function getWorkoutSessionDetails(
  id: string
): Promise<WorkoutSessionWithSets | null> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [id]
  );

  if (!session) return null;

  const sets = await db.getAllAsync<WorkoutSetDetail>(
    `SELECT
       ws.*,
       e.name AS exercise_name,
       e.target_muscle
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_session_id = ?
     ORDER BY ws.exercise_id, ws.set_order ASC`,
    [id]
  );

  return {
    ...session,
    sets,
  };
}

export async function deleteWorkoutSession(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
  return result.changes > 0;
}

export interface OverallStats {
  totalWorkouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalDurationMinutes: number;
}

export async function getOverallStats(): Promise<OverallStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    count: number;
    volume: number;
    sets: number;
    duration: number;
  }>(`
    SELECT
      COUNT(id) AS count,
      COALESCE(SUM(total_volume), 0) AS volume,
      COALESCE(SUM(total_sets), 0) AS sets,
      COALESCE(SUM(duration_seconds), 0) AS duration
    FROM workout_sessions
    WHERE completed = 1
  `);

  return {
    totalWorkouts: row?.count || 0,
    totalVolumeKg: Math.round(row?.volume || 0),
    totalSets: row?.sets || 0,
    totalDurationMinutes: Math.round((row?.duration || 0) / 60),
  };
}
