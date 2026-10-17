import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise } from '../types';
import { getAllExercises } from '../database/exerciseRepository';
import { getDatabase, runInTransaction } from '../database/db';
import { syncFavoritesToCloud, fetchFavoritesFromCloud } from './cloudSyncService';
import seedData from '../database/seedData.json';

export const STORAGE_KEY_FAVORITES = '@vitax_favorite_exercise_ids';

/**
 * Récupère les IDs des exercices favoris
 * Priorité : Base de données SQLite locale -> Cache AsyncStorage -> Cloud Supabase
 */
export async function getFavoriteExerciseIds(): Promise<string[]> {
  try {
    // 1. Lecture prioritaire depuis la base de données SQLite locale
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ exercise_id: string }>(
        'SELECT exercise_id FROM exercise_favorites ORDER BY created_at DESC'
      );
      if (rows && rows.length > 0) {
        const ids = rows.map((r) => r.exercise_id);
        // Mise à jour silencieuse du cache AsyncStorage pour cohérence
        void AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(ids)).catch(() => {});
        return ids;
      }
    } catch {
      // Table SQLite peut ne pas être encore prête
    }

    // 2. Repli sur le cache AsyncStorage
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FAVORITES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enregistrer dans SQLite pour pérenniser
        try {
          const db = await getDatabase();
          const now = new Date().toISOString();
          await runInTransaction(db, async () => {
            for (const exId of parsed) {
              await db.runAsync(
                'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
                [exId, now]
              );
            }
          });
        } catch {}
        return parsed;
      }
    }

    // 3. Si local vide (nouvel appareil ou réinstallation), restaurer depuis Supabase
    const cloudFavs = await fetchFavoritesFromCloud();
    if (cloudFavs && cloudFavs.length > 0) {
      // Sauvegarder dans SQLite et AsyncStorage
      try {
        const db = await getDatabase();
        const now = new Date().toISOString();
        await runInTransaction(db, async () => {
          for (const exId of cloudFavs) {
            await db.runAsync(
              'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
              [exId, now]
            );
          }
        });
      } catch {}
      await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(cloudFavs));
      return cloudFavs;
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Bascule l'état favori d'un exercice (ajoute si absent, retire si présent)
 * Sauvegarde synchrone dans SQLite et AsyncStorage + synchronisation Cloud Supabase
 */
export async function toggleFavoriteExercise(exerciseId: string): Promise<boolean> {
  try {
    const current = await getFavoriteExerciseIds();
    const exists = current.includes(exerciseId);
    let updated: string[];

    if (exists) {
      updated = current.filter((id) => id !== exerciseId);
    } else {
      updated = [exerciseId, ...current];
    }

    // 1. Sauvegarde dans la base SQLite locale
    try {
      const db = await getDatabase();
      if (exists) {
        await db.runAsync('DELETE FROM exercise_favorites WHERE exercise_id = ?', [exerciseId]);
      } else {
        await db.runAsync(
          'INSERT OR REPLACE INTO exercise_favorites (exercise_id, created_at) VALUES (?, ?)',
          [exerciseId, new Date().toISOString()]
        );
      }
    } catch (dbErr) {
      console.warn('Erreur persistance SQLite favori:', dbErr);
    }

    // 2. Sauvegarde dans AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));

    // 3. Synchronisation Cloud Supabase
    void syncFavoritesToCloud(updated);

    return !exists; // retourne true si maintenant favori
  } catch {
    return false;
  }
}

/**
 * Vérifie si un exercice est actuellement en favori
 */
export async function isExerciseFavorite(exerciseId: string): Promise<boolean> {
  const favorites = await getFavoriteExerciseIds();
  return favorites.includes(exerciseId);
}


/**
 * Récupère la liste des objets Exercise complets marqués en favoris
 */
export async function getFavoriteExercises(): Promise<Exercise[]> {
  try {
    const [allRaw, favIds] = await Promise.all([
      getAllExercises(),
      getFavoriteExerciseIds(),
    ]);
    if (favIds.length === 0) return [];

    let all = allRaw;
    if (!all || all.length === 0) {
      all = (seedData.exercises as Exercise[]) || [];
    }

    return favIds
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Exercise => Boolean(e));
  } catch {
    return [];
  }
}
