import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from './db';
import {
  BackupData,
  Exercise,
  Program,
  ProgramExercise,
  WorkoutSession,
  WorkoutSet,
  BodyWeightLog,
  FitnessGoal,
} from '../types';
import { useSettingsStore } from '../stores/settingsStore';

export async function exportAllData(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const db = await getDatabase();

    const exercises = await db.getAllAsync<Exercise>('SELECT * FROM exercises');
    const programs = await db.getAllAsync<Program>('SELECT * FROM programs');
    const program_exercises = await db.getAllAsync<ProgramExercise>('SELECT * FROM program_exercises');
    const workout_sessions = await db.getAllAsync<WorkoutSession>('SELECT * FROM workout_sessions');
    const workout_sets = await db.getAllAsync<WorkoutSet>('SELECT * FROM workout_sets');
    const body_weights = await db.getAllAsync<BodyWeightLog>('SELECT * FROM body_weights');
    const fitness_goals = await db.getAllAsync<FitnessGoal>('SELECT * FROM fitness_goals');
    const running_sessions = await db.getAllAsync<any>('SELECT * FROM running_sessions');
    let favorite_exercise_ids: string[] = [];
    try {
      const favRows = await db.getAllAsync<{ exercise_id: string }>(
        'SELECT exercise_id FROM exercise_favorites'
      );
      favorite_exercise_ids = favRows.map((r) => r.exercise_id);
    } catch {}

    const userPrefs = useSettingsStore.getState();
    const backup: BackupData = {
      app: 'Vitax',
      version: '1.0',
      exported_at: new Date().toISOString(),
      exercises,
      programs,
      program_exercises,
      workout_sessions,
      workout_sets,
      body_weights,
      fitness_goals,
      running_sessions,
      favorite_exercise_ids,
      preferences: {
        user_name: userPrefs.user_name,
        user_height_cm: userPrefs.user_height_cm,
        default_rest_seconds: userPrefs.default_rest_seconds,
        haptic_enabled: userPrefs.haptic_enabled,
        sound_enabled: userPrefs.sound_enabled,
        weight_unit: userPrefs.weight_unit,
      },
    };

    const fileName = `vitax_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
    const jsonString = JSON.stringify(backup, null, 2);

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return { success: true, filePath: fileName };
    }

    // Écriture du fichier dans le répertoire de cache
    const targetFile = new File(Paths.cache, fileName);
    if (targetFile.exists) {
      targetFile.delete();
    }
    targetFile.create();
    targetFile.write(jsonString);

    const shareAvailable = await Sharing.isAvailableAsync();
    if (shareAvailable) {
      await Sharing.shareAsync(targetFile.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Exporter les données Vitax',
        UTI: 'public.json',
      });
    }

    return { success: true, filePath: targetFile.uri };
  } catch (err: any) {
    console.error('Erreur export données:', err);
    return { success: false, error: err.message || 'Échec de l’exportation' };
  }
}

export async function importDataFromFile(): Promise<{
  success: boolean;
  sessionsCount?: number;
  error?: string;
}> {
  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return { success: false, error: 'Opération annulée' };
    }

    const asset = pickerResult.assets[0];
    let content = '';

    const MAX_BACKUP_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo max
    if (typeof (asset as any).size === 'number' && (asset as any).size > MAX_BACKUP_FILE_BYTES) {
      return {
        success: false,
        error: 'Fichier trop volumineux (limite maximale de sécurité : 10 Mo).',
      };
    }

    if (Platform.OS === 'web') {
      if ((asset as any).file && typeof (asset as any).file.text === 'function') {
        content = await (asset as any).file.text();
      } else if (asset.uri) {
        const res = await fetch(asset.uri);
        content = await res.text();
      }
    } else {
      const sourceFile = new File(asset.uri);
      content = await sourceFile.text();
    }

    if (content.length > MAX_BACKUP_FILE_BYTES) {
      return {
        success: false,
        error: 'Fichier trop volumineux (limite maximale de sécurité : 10 Mo).',
      };
    }

    const backupData: BackupData = JSON.parse(content);

    if (
      !backupData ||
      typeof backupData !== 'object' ||
      backupData.app !== 'Vitax' ||
      !Array.isArray(backupData.exercises) ||
      !Array.isArray(backupData.programs) ||
      !Array.isArray(backupData.program_exercises) ||
      !Array.isArray(backupData.workout_sessions) ||
      !Array.isArray(backupData.workout_sets)
    ) {
      return { success: false, error: 'Fichier invalide : schéma de sauvegarde Vitax non conforme.' };
    }

    const safeStr = (val: unknown, maxLen: number = 500, fallback: string = ''): string => {
      if (typeof val !== 'string') return fallback;
      return val.slice(0, maxLen);
    };

    const safeNum = (val: unknown, min: number, max: number, fallback: number = 0): number => {
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };

    const db = await getDatabase();
    const { runInTransaction } = await import('./db');
    const nowIso = new Date().toISOString();

    await runInTransaction(db, async () => {
      // Import des exercices personnalisés ou manquants
      for (const ex of backupData.exercises.slice(0, 2000)) {
        if (!ex || typeof ex.id !== 'string' || !ex.id.trim() || typeof ex.name !== 'string') continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            safeStr(ex.id, 120),
            safeStr(ex.name, 200),
            safeStr(ex.description, 2000),
            safeStr(ex.target_muscle, 100, 'Autre'),
            safeStr(ex.equipment_needed, 100, 'Aucun'),
            ex.is_custom ? 1 : 0,
          ]
        );
      }

      // Import des programmes
      for (const p of backupData.programs.slice(0, 500)) {
        if (!p || typeof p.id !== 'string' || !p.id.trim() || typeof p.name !== 'string') continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO programs (id, name, description, difficulty_level, is_custom, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            safeStr(p.id, 120),
            safeStr(p.name, 200),
            safeStr(p.description, 2000),
            safeStr(p.difficulty_level, 80, 'Intermédiaire'),
            p.is_custom ? 1 : 0,
            safeStr(p.created_at, 64, nowIso),
          ]
        );
      }

      // Import des program_exercises
      for (const pe of backupData.program_exercises.slice(0, 5000)) {
        if (!pe || typeof pe.id !== 'string' || typeof pe.program_id !== 'string' || typeof pe.exercise_id !== 'string') continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO program_exercises (
             id, program_id, exercise_id, default_sets, default_reps, rest_time_seconds, order_index
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            safeStr(pe.id, 120),
            safeStr(pe.program_id, 120),
            safeStr(pe.exercise_id, 120),
            Math.round(safeNum(pe.default_sets, 1, 50, 3)),
            Math.round(safeNum(pe.default_reps, 1, 1000, 10)),
            Math.round(safeNum(pe.rest_time_seconds, 0, 3600, 90)),
            Math.round(safeNum(pe.order_index, 0, 500, 0)),
          ]
        );
      }

      // Import des séances d'entraînement
      for (const s of backupData.workout_sessions.slice(0, 10000)) {
        if (!s || typeof s.id !== 'string' || !s.id.trim()) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO workout_sessions (
             id, program_id, program_name, date, duration_seconds, notes, total_volume, total_sets, completed, calories
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            safeStr(s.id, 120),
            s.program_id ? safeStr(s.program_id, 120) : null,
            safeStr(s.program_name, 200, 'Séance libre'),
            safeStr(s.date, 64, nowIso),
            Math.round(safeNum(s.duration_seconds, 0, 86400, 0)),
            s.notes ? safeStr(s.notes, 2000) : null,
            safeNum(s.total_volume, 0, 1000000, 0),
            Math.round(safeNum(s.total_sets, 0, 1000, 0)),
            s.completed ? 1 : 0,
            s.calories != null ? Math.round(safeNum(s.calories, 0, 10000, 0)) : null,
          ]
        );
      }

      // Import des séries
      for (const st of backupData.workout_sets.slice(0, 100000)) {
        if (!st || typeof st.id !== 'string' || typeof st.workout_session_id !== 'string' || typeof st.exercise_id !== 'string') continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO workout_sets (
             id, workout_session_id, exercise_id, set_order, weight, reps, completed, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            safeStr(st.id, 120),
            safeStr(st.workout_session_id, 120),
            safeStr(st.exercise_id, 120),
            Math.round(safeNum(st.set_order, 1, 500, 1)),
            safeNum(st.weight, 0, 2000, 0),
            Math.round(safeNum(st.reps, 0, 10000, 0)),
            st.completed ? 1 : 0,
            safeStr(st.created_at, 64, nowIso),
          ]
        );
      }

      // Importer les pesées corporelles
      if (Array.isArray(backupData.body_weights)) {
        for (const bw of backupData.body_weights.slice(0, 5000)) {
          if (!bw || typeof bw.id !== 'string' || !bw.id.trim()) continue;
          await db.runAsync(
            `INSERT OR REPLACE INTO body_weights (
               id, weight, date, note, body_fat_percentage, created_at
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              safeStr(bw.id, 120),
              safeNum(bw.weight, 20, 400, 70),
              safeStr(bw.date, 64, nowIso),
              bw.note ? safeStr(bw.note, 500) : null,
              bw.body_fat_percentage != null ? safeNum(bw.body_fat_percentage, 1, 80, 15) : null,
              safeStr(bw.created_at, 64, nowIso),
            ]
          );
        }
      }

      // Importer les objectifs
      if (Array.isArray(backupData.fitness_goals)) {
        for (const fg of backupData.fitness_goals.slice(0, 1000)) {
          if (!fg || typeof fg.id !== 'string' || !fg.id.trim()) continue;
          await db.runAsync(
            `INSERT OR REPLACE INTO fitness_goals (
               id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              safeStr(fg.id, 120),
              safeStr(fg.title, 200, 'Objectif'),
              safeStr(fg.category, 80, 'strength'),
              safeNum(fg.target_value, 0, 1000000, 0),
              safeNum(fg.starting_value, 0, 1000000, 0),
              safeNum(fg.current_value, 0, 1000000, 0),
              safeStr(fg.unit, 20, 'kg'),
              fg.target_date ? safeStr(fg.target_date, 64) : null,
              fg.exercise_id ? safeStr(fg.exercise_id, 120) : null,
              fg.completed ? 1 : 0,
              fg.completed_at ? safeStr(fg.completed_at, 64) : null,
              safeStr(fg.created_at, 64, nowIso),
            ]
          );
        }
      }

      // Importer les sessions de course / marche
      if (Array.isArray(backupData.running_sessions)) {
        for (const rs of backupData.running_sessions.slice(0, 5000)) {
          if (!rs || typeof rs.id !== 'string' || !rs.id.trim()) continue;
          await db.runAsync(
            `INSERT OR REPLACE INTO running_sessions (
               id, date, distance_km, duration_seconds, pace_seconds_per_km, notes, calories, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              safeStr(rs.id, 120),
              safeStr(rs.date, 64, nowIso),
              safeNum(rs.distance_km, 0, 500, 0),
              Math.round(safeNum(rs.duration_seconds, 0, 86400, 0)),
              safeNum(rs.pace_seconds_per_km, 0, 7200, 0),
              rs.notes ? safeStr(rs.notes, 1000) : null,
              rs.calories != null ? Math.round(safeNum(rs.calories, 0, 20000, 0)) : null,
              safeStr(rs.created_at, 64, nowIso),
            ]
          );
        }
      }

      // Importer les exercices favoris
      if (
        Array.isArray(backupData.favorite_exercise_ids) &&
        backupData.favorite_exercise_ids.length > 0
      ) {
        for (const exId of backupData.favorite_exercise_ids.slice(0, 500)) {
          if (typeof exId !== 'string' || !exId.trim()) continue;
          await db.runAsync(
            'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
            [safeStr(exId, 120), nowIso]
          );
        }
      }
    });

    if (
      Array.isArray(backupData.favorite_exercise_ids) &&
      backupData.favorite_exercise_ids.length > 0
    ) {
      try {
        const { STORAGE_KEY_FAVORITES } = await import('../services/favoritesService');
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem(
          STORAGE_KEY_FAVORITES,
          JSON.stringify(backupData.favorite_exercise_ids)
        );
        const { syncFavoritesToCloud } = await import('../services/cloudSyncService');
        void syncFavoritesToCloud(backupData.favorite_exercise_ids);
      } catch {}
    }

    // Déclencher une synchronisation d'arrière-plan vers Supabase pour sécuriser l'import
    try {
      const { pushLocalToCloud } = await import('../services/cloudSyncService');
      void pushLocalToCloud();
    } catch {}

    if (backupData.preferences) {
      if (backupData.preferences.user_name) {
        await useSettingsStore.getState().setUserName(backupData.preferences.user_name);
      }
      if (backupData.preferences.user_height_cm) {
        await useSettingsStore.getState().setUserHeight(backupData.preferences.user_height_cm);
      }
      if (backupData.preferences.default_rest_seconds) {
        await useSettingsStore.getState().setDefaultRestSeconds(backupData.preferences.default_rest_seconds);
      }
      if (backupData.preferences.weight_unit) {
        await useSettingsStore.getState().setWeightUnit(backupData.preferences.weight_unit);
      }
    }

    return {
      success: true,
      sessionsCount: backupData.workout_sessions.length,
    };
  } catch (err: any) {
    console.error('Erreur import données:', err);
    return { success: false, error: err.message || 'Échec de l’importation' };
  }
}
