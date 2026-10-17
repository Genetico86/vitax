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

    const backupData: BackupData = JSON.parse(content);

    if (!backupData || backupData.app !== 'Vitax' || !Array.isArray(backupData.exercises)) {
      return { success: false, error: 'Fichier invalide : ce n’est pas une sauvegarde Vitax.' };
    }

    const db = await getDatabase();
    const { runInTransaction } = await import('./db');
    const nowIso = new Date().toISOString();

    await runInTransaction(db, async () => {
      // Import des exercices personnalisés ou manquants
      for (const ex of backupData.exercises) {
        await db.runAsync(
          `INSERT OR REPLACE INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [ex.id, ex.name, ex.description, ex.target_muscle, ex.equipment_needed, ex.is_custom]
        );
      }

      // Import des programmes
      for (const p of backupData.programs) {
        await db.runAsync(
          `INSERT OR REPLACE INTO programs (id, name, description, difficulty_level, is_custom, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.description, p.difficulty_level, p.is_custom, p.created_at || nowIso]
        );
      }

      // Import des program_exercises
      for (const pe of backupData.program_exercises) {
        await db.runAsync(
          `INSERT OR REPLACE INTO program_exercises (
             id, program_id, exercise_id, default_sets, default_reps, rest_time_seconds, order_index
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pe.id,
            pe.program_id,
            pe.exercise_id,
            pe.default_sets,
            pe.default_reps,
            pe.rest_time_seconds,
            pe.order_index,
          ]
        );
      }

      // Import des séances d'entraînement
      for (const s of backupData.workout_sessions) {
        await db.runAsync(
          `INSERT OR REPLACE INTO workout_sessions (
             id, program_id, program_name, date, duration_seconds, notes, total_volume, total_sets, completed
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.program_id,
            s.program_name,
            s.date,
            s.duration_seconds,
            s.notes,
            s.total_volume,
            s.total_sets,
            s.completed,
          ]
        );
      }

      // Import des séries
      for (const st of backupData.workout_sets) {
        await db.runAsync(
          `INSERT OR REPLACE INTO workout_sets (
             id, workout_session_id, exercise_id, set_order, weight, reps, completed, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            st.id,
            st.workout_session_id,
            st.exercise_id,
            st.set_order,
            st.weight,
            st.reps,
            st.completed,
            st.created_at || nowIso,
          ]
        );
      }

      // Importer les pesées corporelles
      if (Array.isArray(backupData.body_weights)) {
        for (const bw of backupData.body_weights) {
          await db.runAsync(
            `INSERT OR REPLACE INTO body_weights (
               id, weight, date, note, body_fat_percentage, created_at
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              bw.id,
              bw.weight,
              bw.date,
              bw.note || null,
              bw.body_fat_percentage || null,
              bw.created_at,
            ]
          );
        }
      }

      // Importer les objectifs
      if (Array.isArray(backupData.fitness_goals)) {
        for (const fg of backupData.fitness_goals) {
          await db.runAsync(
            `INSERT OR REPLACE INTO fitness_goals (
               id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fg.id,
              fg.title,
              fg.category,
              fg.target_value,
              fg.starting_value,
              fg.current_value,
              fg.unit,
              fg.target_date || null,
              fg.exercise_id || null,
              fg.completed,
              fg.completed_at || null,
              fg.created_at,
            ]
          );
        }
      }

      // Importer les sessions de course / marche
      if (Array.isArray(backupData.running_sessions)) {
        for (const rs of backupData.running_sessions) {
          await db.runAsync(
            `INSERT OR REPLACE INTO running_sessions (
               id, date, distance_km, duration_seconds, pace_seconds_per_km, notes, calories, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              rs.id,
              rs.date,
              rs.distance_km,
              rs.duration_seconds,
              rs.pace_seconds_per_km,
              rs.notes || null,
              rs.calories || null,
              rs.created_at || nowIso,
            ]
          );
        }
      }

      // Importer les exercices favoris
      if (
        Array.isArray(backupData.favorite_exercise_ids) &&
        backupData.favorite_exercise_ids.length > 0
      ) {
        for (const exId of backupData.favorite_exercise_ids) {
          await db.runAsync(
            'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
            [exId, nowIso]
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
