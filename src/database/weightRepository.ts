import { getDatabase } from './db';
import { BodyWeightLog, WeightProgressStats } from '../types';
import { syncBodyWeightToCloud, fetchBodyWeightsFromCloud } from '../services/cloudSyncService';

export async function getAllWeightLogs(): Promise<BodyWeightLog[]> {
  const db = await getDatabase();
  let rows = await db.getAllAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC'
  );

  if (rows.length === 0) {
    try {
      const cloudWeights = await fetchBodyWeightsFromCloud();
      if (cloudWeights.length > 0) {
        for (const w of cloudWeights) {
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
        rows = await db.getAllAsync<BodyWeightLog>(
          'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC'
        );
      }
    } catch (err) {
      console.warn('Erreur synchro cloud poids:', err);
    }
  }

  return rows;
}

export async function getRecentWeightLogs(limit = 30): Promise<BodyWeightLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC LIMIT ?',
    [limit]
  );
  return rows;
}

export async function getLatestWeightLog(): Promise<BodyWeightLog | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC LIMIT 1'
  );
  return row || null;
}

export async function addWeightLog(
  weight: number,
  date?: string,
  note?: string,
  bodyFatPercentage?: number
): Promise<BodyWeightLog> {
  const db = await getDatabase();
  const logDate = date || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const id = `bw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newLog: BodyWeightLog = {
    id,
    weight: Math.round(weight * 10) / 10,
    date: logDate,
    note: note?.trim() || undefined,
    body_fat_percentage: bodyFatPercentage ? Math.round(bodyFatPercentage * 10) / 10 : undefined,
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO body_weights (id, weight, date, note, body_fat_percentage, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      newLog.id,
      newLog.weight,
      newLog.date,
      newLog.note || null,
      newLog.body_fat_percentage || null,
      newLog.created_at,
    ]
  );

  // Synchronisation Cloud Supabase
  void syncBodyWeightToCloud(newLog);

  return newLog;
}

export async function deleteWeightLog(id: string): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM body_weights WHERE id = ?', [id]);
  return res.changes > 0;
}

export async function getWeightStats(heightCm?: number): Promise<WeightProgressStats> {
  const db = await getDatabase();
  const logs = await db.getAllAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date ASC, created_at ASC'
  );

  if (logs.length === 0) {
    return {
      currentWeight: null,
      startingWeight: null,
      lowestWeight: null,
      highestWeight: null,
      deltaTotal: 0,
      delta7Days: 0,
      delta30Days: 0,
      logsCount: 0,
      bmi: null,
    };
  }

  const starting = logs[0].weight;
  const current = logs[logs.length - 1].weight;
  const weights = logs.map((l) => l.weight);
  const lowest = Math.min(...weights);
  const highest = Math.max(...weights);

  const deltaTotal = Math.round((current - starting) * 10) / 10;

  // Calcul delta 7j et 30j
  const currentDate = new Date(logs[logs.length - 1].date).getTime();
  const sevenDaysAgo = currentDate - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = currentDate - 30 * 24 * 60 * 60 * 1000;

  const log7Days = logs.filter((l) => new Date(l.date).getTime() <= sevenDaysAgo).pop();
  const log30Days = logs.filter((l) => new Date(l.date).getTime() <= thirtyDaysAgo).pop();

  const delta7Days = log7Days ? Math.round((current - log7Days.weight) * 10) / 10 : 0;
  const delta30Days = log30Days ? Math.round((current - log30Days.weight) * 10) / 10 : 0;

  let bmi: number | null = null;
  if (heightCm && heightCm > 50 && heightCm < 250) {
    const heightM = heightCm / 100;
    bmi = Math.round((current / (heightM * heightM)) * 10) / 10;
  }

  return {
    currentWeight: current,
    startingWeight: starting,
    lowestWeight: lowest,
    highestWeight: highest,
    deltaTotal,
    delta7Days,
    delta30Days,
    logsCount: logs.length,
    bmi,
  };
}
