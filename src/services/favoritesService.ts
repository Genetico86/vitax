import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise } from '../types';
import { getAllExercises } from '../database/exerciseRepository';
import { syncFavoritesToCloud, fetchFavoritesFromCloud } from './cloudSyncService';
import seedData from '../database/seedData.json';

export const STORAGE_KEY_FAVORITES = '@vitax_favorite_exercise_ids';

/**
 * Récupère les IDs des exercices favoris
 */
export async function getFavoriteExerciseIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FAVORITES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Si local vide (ex: sur Web ou nouvel appareil), tenter de récupérer depuis Supabase
    const cloudFavs = await fetchFavoritesFromCloud();
    if (cloudFavs.length > 0) {
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
    await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));

    // Synchronisation Cloud Supabase
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
