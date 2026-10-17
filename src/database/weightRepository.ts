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
  let row = await db.getFirstAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC LIMIT 1'
  );

  if (!row) {
    try {
      const cloudWeights = await fetchBodyWeightsFromCloud();
      if (cloudWeights.length > 0) {
        row = await db.getFirstAsync<BodyWeightLog>(
          'SELECT * FROM body_weights ORDER BY date DESC, created_at DESC LIMIT 1'
        );
      }
    } catch {}
  }

  return row || null;
}

export async function addWeightLog(
  weight: number,
  date?: string,
  note?: string,
  bodyFatPercentage?: number
): Promise<BodyWeightLog> {
  const db = await getDatabase();
  const logDate = date && date.trim().length >= 10 ? date.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const roundedWeight = Math.round(weight * 10) / 10;
  const roundedFat = bodyFatPercentage ? Math.round(bodyFatPercentage * 10) / 10 : undefined;

  // Vérifier si une pesée existe déjà pour cette date précise
  const existingForDate = await db.getFirstAsync<BodyWeightLog>(
    'SELECT * FROM body_weights WHERE date = ?',
    [logDate]
  );

  let resultLog: BodyWeightLog;

  if (existingForDate) {
    // Met à jour la pesée existante pour cette date (historisation par jour sans écraser les autres dates)
    await db.runAsync(
      `UPDATE body_weights 
       SET weight = ?, note = ?, body_fat_percentage = ?, created_at = ?
       WHERE id = ?`,
      [
        roundedWeight,
        note?.trim() || null,
        roundedFat || null,
        now,
        existingForDate.id,
      ]
    );

    resultLog = {
      id: existingForDate.id,
      weight: roundedWeight,
      date: logDate,
      note: note?.trim() || undefined,
      body_fat_percentage: roundedFat,
      created_at: now,
    };
  } else {
    // Insère une nouvelle pesée historisée pour cette nouvelle date
    const id = `bw_${logDate}_${Date.now()}`;
    resultLog = {
      id,
      weight: roundedWeight,
      date: logDate,
      note: note?.trim() || undefined,
      body_fat_percentage: roundedFat,
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO body_weights (id, weight, date, note, body_fat_percentage, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        resultLog.id,
        resultLog.weight,
        resultLog.date,
        resultLog.note || null,
        resultLog.body_fat_percentage || null,
        resultLog.created_at,
      ]
    );
  }

  // Synchronisation Cloud Supabase complète de l'historique
  void syncBodyWeightToCloud(resultLog);

  return resultLog;
}

export async function deleteWeightLog(id: string): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM body_weights WHERE id = ?', [id]);
  if (res.changes > 0) {
    // Mettre à jour la sauvegarde cloud et marquer l'ID comme supprimé
    const { deleteWeightLogFromCloud } = await import('../services/cloudSyncService');
    void deleteWeightLogFromCloud(id);
  }
  return res.changes > 0;
}

export async function getWeightStats(heightCm?: number): Promise<WeightProgressStats> {
  const db = await getDatabase();
  let logs = await db.getAllAsync<BodyWeightLog>(
    'SELECT * FROM body_weights ORDER BY date ASC, created_at ASC'
  );

  // Tentative de restauration cloud si la base locale est vide
  if (logs.length === 0) {
    try {
      const cloudWeights = await fetchBodyWeightsFromCloud();
      if (cloudWeights.length > 0) {
        logs = await db.getAllAsync<BodyWeightLog>(
          'SELECT * FROM body_weights ORDER BY date ASC, created_at ASC'
        );
      }
    } catch {}
  }

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
    let currentKg = current;
    try {
      const { useSettingsStore } = await import('../stores/settingsStore');
      if (useSettingsStore.getState().weight_unit === 'lbs' && current > 110) {
        currentKg = current / 2.20462;
      }
    } catch {}
    bmi = Math.round((currentKg / (heightM * heightM)) * 10) / 10;
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

/**
 * Récupère l'historique de poids entre deux dates (format YYYY-MM-DD)
 */
export async function getWeightLogsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyWeightLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<BodyWeightLog>(
    'SELECT * FROM body_weights WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
}
