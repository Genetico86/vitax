import { getDatabase } from './db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RunningSession, RunningStats } from '../types';
import {
  syncRunningSessionsToCloud,
  fetchRunningSessionsFromCloud,
  deleteRunningSessionFromCloud,
} from '../services/cloudSyncService';
import { calculateRunningSessionXp } from '../services/gamificationService';

export const STORAGE_KEY_RUNNING_SESSIONS = '@vitax_running_sessions_v1';

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
  xp_earned?: number;
}): Promise<RunningSession> {
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
  const isWalk = Boolean(params.notes && params.notes.includes('[Marche]'));
  const xp_earned =
    params.xp_earned !== undefined
      ? params.xp_earned
      : calculateRunningSessionXp(distance, duration, isWalk);

  const sessionRecord: RunningSession = {
    id,
    date,
    distance_km: distance,
    duration_seconds: duration,
    pace_seconds_per_km: pace,
    notes: params.notes?.trim() || null,
    calories,
    created_at: now,
    xp_earned,
  };

  // 1. Sauvegarde dans SQLite
  try {
    const db = await getDatabase();
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
  } catch (err) {
    console.warn('Erreur SQLite createRunningSession:', err);
  }

  // 2. Sauvegarde dans AsyncStorage (cache instantané pour Web PWA)
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_RUNNING_SESSIONS);
    const list: RunningSession[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((r) => r.id !== id);
    filtered.unshift(sessionRecord);
    await AsyncStorage.setItem(STORAGE_KEY_RUNNING_SESSIONS, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Erreur AsyncStorage createRunningSession:', err);
  }

  // 3. Synchronisation Cloud Supabase en temps réel
  void syncRunningSessionsToCloud();

  return sessionRecord;
}

export async function getAllRunningSessions(): Promise<RunningSession[]> {
  let rows: RunningSession[] = [];
  try {
    const db = await getDatabase();
    rows = await db.getAllAsync<RunningSession>(
      'SELECT * FROM running_sessions ORDER BY date DESC, created_at DESC'
    );
  } catch (err) {
    console.warn('Erreur SQLite getAllRunningSessions:', err);
  }

  // Repli sur AsyncStorage pour le Web / PWA hors-ligne
  if (!rows || rows.length === 0) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_RUNNING_SESSIONS);
      if (raw) {
        const parsed: RunningSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rows = parsed;
        }
      }
    } catch {}
  }

  // Repli sur le cloud si vide
  if (!rows || rows.length === 0) {
    try {
      const cloudRuns = await fetchRunningSessionsFromCloud();
      if (cloudRuns && cloudRuns.length > 0) {
        rows = cloudRuns;
        void AsyncStorage.setItem(STORAGE_KEY_RUNNING_SESSIONS, JSON.stringify(cloudRuns)).catch(() => {});
      }
    } catch {}
  }

  // Calculer l'XP pour chaque session si manquant
  return (rows || []).map((r) => {
    const isWalk = Boolean(r.notes && r.notes.includes('[Marche]'));
    const xp = r.xp_earned ?? calculateRunningSessionXp(r.distance_km, r.duration_seconds, isWalk);
    return { ...r, xp_earned: xp };
  });
}

export async function deleteRunningSession(id: string): Promise<boolean> {
  let success = false;
  try {
    const db = await getDatabase();
    const res = await db.runAsync('DELETE FROM running_sessions WHERE id = ?', [id]);
    success = (res?.changes || 0) > 0;
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_RUNNING_SESSIONS);
    if (raw) {
      const list: RunningSession[] = JSON.parse(raw);
      const filtered = list.filter((r) => r.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY_RUNNING_SESSIONS, JSON.stringify(filtered));
      success = true;
    }
  } catch {}

  void deleteRunningSessionFromCloud(id);
  return success;
}

export async function getRunningStats(): Promise<RunningStats> {
  const sessions = await getAllRunningSessions();

  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationSeconds: 0,
      bestPaceSecondsPerKm: 0,
      averagePaceSecondsPerKm: 0,
      averageDistanceKm: 0,
      totalXpEarned: 0,
    };
  }

  const totalSessions = sessions.length;
  const totalDistance = sessions.reduce((acc, s) => acc + (s.distance_km || 0), 0);
  const totalDuration = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const validPaces = sessions
    .map((s) => s.pace_seconds_per_km)
    .filter((p) => p && p > 0);
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) : 0;
  const avgDistance = totalDistance / totalSessions;
  const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0;
  const totalXpEarned = sessions.reduce((acc, s) => acc + (s.xp_earned || 0), 0);

  return {
    totalSessions,
    totalDistanceKm: Number(totalDistance.toFixed(2)),
    totalDurationSeconds: Math.round(totalDuration),
    bestPaceSecondsPerKm: Math.round(bestPace),
    averagePaceSecondsPerKm: Math.round(avgPace),
    averageDistanceKm: Number(avgDistance.toFixed(2)),
    totalXpEarned,
  };
}
