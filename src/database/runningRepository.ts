import { getDatabase } from './db';
import { RunningSession, RunningStats } from '../types';
import {
  syncRunningSessionsToCloud,
  fetchRunningSessionsFromCloud,
  deleteRunningSessionFromCloud,
} from '../services/cloudSyncService';

export function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return "--'--\" / km";
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}'${secs.toString().padStart(2, '0')}" / km`;
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export async function createRunningSession(params: {
  distance_km: number;
  duration_seconds: number;
  date?: string;
  notes?: string;
  calories?: number;
}): Promise<RunningSession> {
  const db = await getDatabase();
  const id = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const date = params.date || new Date().toISOString();
  const distance = Math.max(0.01, Number(params.distance_km));
  const duration = Math.max(1, Math.round(params.duration_seconds));
  const pace = Math.round(duration / distance);
  const calories =
    params.calories && params.calories > 0
      ? params.calories
      : Math.round(distance * 65); // Estimation standard ~65 kcal/km
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO running_sessions (id, date, distance_km, duration_seconds, pace_seconds_per_km, notes, calories, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      date,
      distance,
      duration,
      pace,
      params.notes?.trim() || null,
      calories,
      now,
    ]
  );

  // Synchronisation Cloud Supabase en temps réel
  void syncRunningSessionsToCloud();

  return {
    id,
    date,
    distance_km: distance,
    duration_seconds: duration,
    pace_seconds_per_km: pace,
    notes: params.notes?.trim() || null,
    calories,
    created_at: now,
  };
}

export async function getAllRunningSessions(): Promise<RunningSession[]> {
  const db = await getDatabase();
  let rows = await db.getAllAsync<RunningSession>(
    'SELECT * FROM running_sessions ORDER BY date DESC, created_at DESC'
  );

  if (!rows || rows.length === 0) {
    try {
      const cloudRuns = await fetchRunningSessionsFromCloud();
      if (cloudRuns.length > 0) {
        rows = await db.getAllAsync<RunningSession>(
          'SELECT * FROM running_sessions ORDER BY date DESC, created_at DESC'
        );
      }
    } catch {}
  }

  return rows || [];
}

export async function deleteRunningSession(id: string): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM running_sessions WHERE id = ?', [id]);
  if ((res?.changes || 0) > 0) {
    void deleteRunningSessionFromCloud(id);
  }
  return (res?.changes || 0) > 0;
}

export async function getRunningStats(): Promise<RunningStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    total_sessions: number;
    total_distance: number;
    total_duration: number;
    best_pace: number | null;
  }>(`
    SELECT
      COUNT(id) AS total_sessions,
      COALESCE(SUM(distance_km), 0) AS total_distance,
      COALESCE(SUM(duration_seconds), 0) AS total_duration,
      MIN(CASE WHEN pace_seconds_per_km > 0 THEN pace_seconds_per_km ELSE NULL END) AS best_pace
    FROM running_sessions
  `);

  if (!row || row.total_sessions === 0) {
    return {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
      bestPaceSecondsPerKm: 0,
      averagePaceSecondsPerKm: 0,
      averageDistanceKm: 0,
    };
  }

  const totalSessions = row.total_sessions;
  const totalDistance = row.total_distance || 0;
  const totalDuration = row.total_duration || 0;
  const avgDistance = totalDistance / totalSessions;
  const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0;

  return {
    totalSessions,
    totalDistanceKm: Number(totalDistance.toFixed(2)),
    totalDurationSeconds: Math.round(totalDuration),
    bestPaceSecondsPerKm: row.best_pace ? Math.round(row.best_pace) : 0,
    averagePaceSecondsPerKm: Math.round(avgPace),
    averageDistanceKm: Number(avgDistance.toFixed(2)),
  };
}
