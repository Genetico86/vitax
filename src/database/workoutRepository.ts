import { getDatabase } from './db';
import { WorkoutSession, WorkoutSet, WorkoutSessionWithSets, WorkoutSetDetail } from '../types';
import {
  syncWorkoutSessionToCloud,
  fetchWorkoutSessionsFromCloud,
  fetchWorkoutDetailsFromCloud,
  deleteWorkoutSessionFromCloud,
} from '../services/cloudSyncService';

export async function saveWorkoutSession(
  session: WorkoutSession,
  sets: WorkoutSet[]
): Promise<void> {
  const db = await getDatabase();

  // Calcul du volume total et du nombre de séries
  const fallbackVolume = sets
    .filter((s) => s.completed === 1)
    .reduce((acc, curr) => acc + curr.weight * curr.reps, 0);

  const totalVolume =
    typeof session.total_volume === 'number' && session.total_volume >= 0
      ? session.total_volume
      : fallbackVolume;

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

  // Synchronisation Cloud Supabase automatique
  void syncWorkoutSessionToCloud(session, sets);
}

export async function getAllWorkoutSessions(): Promise<WorkoutSession[]> {
  const db = await getDatabase();
  let localSessions = await db.getAllAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL) ORDER BY date DESC"
  );

  // Synchronisation avec le cloud Supabase
  try {
    const cloudSessions = await fetchWorkoutSessionsFromCloud();
    if (cloudSessions.length > 0) {
      const localIds = new Set(localSessions.map((s) => s.id));
      const missingFromLocal = cloudSessions.filter((cs) => !localIds.has(cs.id));

      for (const s of missingFromLocal) {
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

      if (missingFromLocal.length > 0) {
        localSessions = await db.getAllAsync<WorkoutSession>(
          "SELECT * FROM workout_sessions WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL) ORDER BY date DESC"
        );
      }
    }
  } catch (err) {
    console.warn('Erreur synchro cloud getAllWorkoutSessions:', err);
  }

  return localSessions;
}

export async function getWorkoutSessionDetails(
  id: string
): Promise<WorkoutSessionWithSets | null> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [id]
  );

  if (!session) {
    // Tenter de récupérer depuis le Cloud si pas trouvé en local
    const remote = await fetchWorkoutDetailsFromCloud(id);
    if (remote) {
      try {
        await saveWorkoutSession(remote, remote.sets);
      } catch {}
    }
    return remote;
  }

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

  if (sets.length === 0) {
    const remote = await fetchWorkoutDetailsFromCloud(id);
    if (remote && remote.sets.length > 0) {
      return remote;
    }
  }

  return {
    ...session,
    sets,
  };
}

export async function deleteWorkoutSession(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', [id]);
  void deleteWorkoutSessionFromCloud(id);
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
    WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)
  `);

  return {
    totalWorkouts: row?.count || 0,
    totalVolumeKg: Math.round(row?.volume || 0),
    totalSets: row?.sets || 0,
    totalDurationMinutes: Math.round((row?.duration || 0) / 60),
  };
}

export interface WeeklyFitnessStats {
  weekWorkoutsCount: number;
  weekExercisesCount: number;
  weekSetsCount: number;
  weekVolumeKg: number;
  fitnessScorePercent: number;
  fitnessLabel: string;
  activeDays: boolean[];
  currentDayIndex: number;
  targetWeeklyWorkouts: number;
  motivationalQuote: string;
}

export async function getWeeklyFitnessStats(): Promise<WeeklyFitnessStats> {
  const db = await getDatabase();
  const now = new Date();

  // Déterminer le lundi 00:00:00 et dimanche 23:59:59 de la semaine en cours en heure locale
  const currentDay = now.getDay(); // 0 = Dimanche, 1 = Lundi, ...
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayTime = monday.getTime();
  const sundayTime = sunday.getTime();
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1;

  // Récupérer toutes les séances complétées (filtrage temporel en JS pour immunité aux fuseaux/formats SQLite)
  const allSessions = await db.getAllAsync<{ id: string; date: string; total_sets: number; total_volume: number }>(
    `SELECT id, date, total_sets, total_volume
     FROM workout_sessions
     WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)
     ORDER BY date ASC`
  );

  const weekSessions: typeof allSessions = [];
  const activeDays = [false, false, false, false, false, false, false];
  const weekSessionIds: string[] = [];

  for (const s of allSessions) {
    if (!s.date) continue;
    const sDate = new Date(s.date);
    const sTime = sDate.getTime();
    if (isNaN(sTime)) continue;

    // Vérifier si la séance appartient à la semaine courante
    if (sTime >= mondayTime && sTime <= sundayTime) {
      weekSessions.push(s);
      weekSessionIds.push(s.id);
      const day = sDate.getDay();
      const dayIndex = day === 0 ? 6 : day - 1;
      activeDays[dayIndex] = true;
    }
  }

  // Nombre d'exercices distincts réalisés cette semaine
  let weekExercisesCount = 0;
  if (weekSessionIds.length > 0) {
    try {
      const placeholders = weekSessionIds.map(() => '?').join(',');
      const distinctRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT ws.exercise_id) AS count
         FROM workout_sets ws
         WHERE ws.workout_session_id IN (${placeholders})
           AND (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)`,
        weekSessionIds
      );
      weekExercisesCount = distinctRow?.count || 0;
    } catch (dErr) {
      console.warn('Erreur calcul exercices distincts semaine:', dErr);
    }
  }

  const weekWorkoutsCount = weekSessions.length;
  const weekSetsCount = weekSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0);
  const weekVolumeKg = Math.round(weekSessions.reduce((sum, s) => sum + (s.total_volume || 0), 0));

  // Objectif hebdomadaire standard : 4 séances (ou combinaison séances + exercices variés)
  const targetWeeklyWorkouts = 4;
  let rawScore = 0;

  if (weekWorkoutsCount > 0) {
    // 1 séance = 25% de base minimum (jusqu'à 75% pour 3-4 séances)
    rawScore = Math.min(75, Math.round((weekWorkoutsCount / targetWeeklyWorkouts) * 75));
    // Bonus d'exercices variés pour couronner l'effort à 100%
    if (weekExercisesCount > 0) {
      rawScore += Math.min(25, weekExercisesCount * 3);
    }
    // Une séance complétée fait immédiatement décoller la jauge à au moins 25%
    rawScore = Math.max(25, rawScore);
  }

  const fitnessScorePercent = Math.min(100, Math.max(0, rawScore));

  let fitnessLabel = 'Prêt à démarrer ! 💪';
  let motivationalQuote = 'Lancez votre première séance de la semaine pour booster la jauge !';

  if (fitnessScorePercent >= 100) {
    fitnessLabel = 'Forme maximale ! 🏆';
    motivationalQuote = 'Semaine de titan ! Vous êtes au sommet de votre condition physique !';
  } else if (fitnessScorePercent >= 75) {
    fitnessLabel = 'Forme optimale 🔥';
    motivationalQuote = 'Rythme exceptionnel ! Plus qu’un effort pour atteindre les 100% !';
  } else if (fitnessScorePercent >= 50) {
    fitnessLabel = 'En pleine dynamique ⚡';
    motivationalQuote = 'Très bon élan hebdomadaire, continuez sur cette belle régularité !';
  } else if (fitnessScorePercent >= 20) {
    fitnessLabel = 'Bonne lancée 🚀';
    motivationalQuote = 'L’entraînement paie ! Gardez le cap pour exploser vos objectifs.';
  }

  return {
    weekWorkoutsCount,
    weekExercisesCount,
    weekSetsCount,
    weekVolumeKg,
    fitnessScorePercent,
    fitnessLabel,
    activeDays,
    currentDayIndex,
    targetWeeklyWorkouts,
    motivationalQuote,
  };
}

export interface DailyExerciseItem {
  exerciseId: string;
  exerciseName: string;
  targetMuscle?: string;
  totalSets: number;
  totalVolumeKg: number;
  maxWeightKg: number;
  maxReps: number;
  sets: {
    sessionId: string;
    programName?: string;
    setOrder: number;
    weight: number;
    reps: number;
    completed: number;
  }[];
}

export interface DailyWorkoutSummary {
  date: string;
  formattedDate: string;
  sessionsCount: number;
  totalVolumeKg: number;
  totalSets: number;
  totalDurationSeconds: number;
  exercises: DailyExerciseItem[];
  sessions: WorkoutSession[];
}

/**
 * Récupère le bilan consolidé de tous les exercices et séances réalisés sur une journée
 * Même si plusieurs séances différentes ont été ouvertes et enregistrées.
 */
export async function getDailyWorkoutSummary(targetDateStr?: string): Promise<DailyWorkoutSummary> {
  const db = await getDatabase();
  const d = targetDateStr ? new Date(targetDateStr) : new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const localDayStr = `${year}-${month}-${day}`;
  const utcDayStr = d.toISOString().split('T')[0];

  const sessions = await db.getAllAsync<WorkoutSession>(
    `SELECT * FROM workout_sessions
     WHERE (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)
       AND (date LIKE ? OR date LIKE ?)
     ORDER BY date ASC`,
    [`${localDayStr}%`, `${utcDayStr}%`]
  );

  const sessionMap = new Map<string, WorkoutSession>();
  sessions.forEach((s) => sessionMap.set(s.id, s));
  const uniqueSessions = Array.from(sessionMap.values());

  const formattedDate = d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (uniqueSessions.length === 0) {
    return {
      date: localDayStr,
      formattedDate,
      sessionsCount: 0,
      totalVolumeKg: 0,
      totalSets: 0,
      totalDurationSeconds: 0,
      exercises: [],
      sessions: [],
    };
  }

  const sessionIds = uniqueSessions.map((s) => s.id);
  const placeholders = sessionIds.map(() => '?').join(',');

  const rawSets = await db.getAllAsync<WorkoutSetDetail & { session_program_name?: string }>(
    `SELECT
       ws.*,
       e.name AS exercise_name,
       e.target_muscle,
       s.program_name AS session_program_name
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     JOIN workout_sessions s ON s.id = ws.workout_session_id
     WHERE ws.workout_session_id IN (${placeholders})
       AND (ws.completed = 1 OR ws.completed = '1' OR ws.completed = true OR ws.completed IS NULL)
     ORDER BY ws.workout_session_id ASC, ws.set_order ASC`,
    sessionIds
  );

  const exerciseMap = new Map<string, DailyExerciseItem>();

  for (const s of rawSets) {
    let item = exerciseMap.get(s.exercise_id);
    if (!item) {
      item = {
        exerciseId: s.exercise_id,
        exerciseName: s.exercise_name,
        targetMuscle: s.target_muscle,
        totalSets: 0,
        totalVolumeKg: 0,
        maxWeightKg: 0,
        maxReps: 0,
        sets: [],
      };
      exerciseMap.set(s.exercise_id, item);
    }

    item.totalSets += 1;
    item.totalVolumeKg += (s.weight || 0) * (s.reps || 0);
    if ((s.weight || 0) > item.maxWeightKg) item.maxWeightKg = s.weight;
    if ((s.reps || 0) > item.maxReps) item.maxReps = s.reps;

    item.sets.push({
      sessionId: s.workout_session_id,
      programName: s.session_program_name,
      setOrder: s.set_order,
      weight: s.weight,
      reps: s.reps,
      completed: s.completed,
    });
  }

  const totalVolumeKg = uniqueSessions.reduce((acc, s) => acc + (s.total_volume || 0), 0);
  const totalSets = uniqueSessions.reduce((acc, s) => acc + (s.total_sets || 0), 0);
  const totalDurationSeconds = uniqueSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

  return {
    date: localDayStr,
    formattedDate,
    sessionsCount: uniqueSessions.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalSets,
    totalDurationSeconds,
    exercises: Array.from(exerciseMap.values()),
    sessions: uniqueSessions,
  };
}

