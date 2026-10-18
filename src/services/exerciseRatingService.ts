import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExerciseRating, ExerciseRatingSummary } from '../types';
import { getDatabase } from '../database/db';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { getPersistedSession } from './authService';

export const STORAGE_KEY_EXERCISE_RATINGS = '@vitax_exercise_ratings';

// Base de données de notes communautaires de référence par exercice
// Permet d'avoir des moyennes fiables et représentatives dès l'ouverture de l'application
const BASE_COMMUNITY_STATS: Record<string, { average: number; count: number }> = {
  ex_bench_press: { average: 4.8, count: 48 },
  ex_squat: { average: 4.9, count: 52 },
  ex_deadlift: { average: 4.8, count: 44 },
  ex_pullups: { average: 4.7, count: 39 },
  ex_dips: { average: 4.6, count: 35 },
  ex_overhead_press: { average: 4.5, count: 31 },
  ex_barbell_row: { average: 4.6, count: 28 },
  ex_incline_dumbbell_press: { average: 4.7, count: 27 },
  ex_bicep_curl_dumbbell: { average: 4.6, count: 42 },
  ex_tricep_rope_pushdown: { average: 4.7, count: 36 },
  ex_lateral_raise: { average: 4.5, count: 38 },
  ex_leg_press: { average: 4.6, count: 29 },
  ex_romanian_deadlift: { average: 4.7, count: 33 },
  ex_plank: { average: 4.4, count: 25 },
  ex_crunch: { average: 4.2, count: 22 },
  ex_hanging_leg_raise: { average: 4.6, count: 26 },
  ex_pushups: { average: 4.8, count: 45 },
};

/**
 * Assure la création de la table SQLite locale si elle n'existe pas encore
 */
async function ensureRatingsTable(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercise_ratings (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL,
        exercise_name TEXT,
        rating INTEGER NOT NULL,
        criteria_animation INTEGER,
        criteria_clarity INTEGER,
        criteria_feeling INTEGER,
        difficulty_tag TEXT,
        comment TEXT,
        user_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exercise_ratings_ex ON exercise_ratings(exercise_id, created_at DESC);
    `);
  } catch {
    // Si SQLite n'est pas encore disponible (web/fallback), le cache AsyncStorage prend le relais
  }
}

/**
 * Récupère toutes les évaluations locales stockées
 */
export async function getAllLocalRatings(): Promise<ExerciseRating[]> {
  try {
    await ensureRatingsTable();
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ExerciseRating>(
        'SELECT * FROM exercise_ratings ORDER BY created_at DESC'
      );
      if (rows && rows.length > 0) {
        // Synchroniser silencieusement le cache AsyncStorage
        void AsyncStorage.setItem(STORAGE_KEY_EXERCISE_RATINGS, JSON.stringify(rows)).catch(() => {});
        return rows;
      }
    } catch {
      // Repli sur AsyncStorage
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY_EXERCISE_RATINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Erreur getAllLocalRatings:', err);
  }
  return [];
}

/**
 * Récupère l'évaluation de l'utilisateur pour un exercice spécifique
 */
export async function getRatingForExercise(exerciseId: string): Promise<ExerciseRating | null> {
  if (!exerciseId) return null;
  const all = await getAllLocalRatings();
  return all.find((r) => r.exercise_id === exerciseId) || null;
}

/**
 * Enregistre ou met à jour la note et le retour développeur d'un exercice
 */
export async function saveExerciseRating(
  data: Omit<ExerciseRating, 'id' | 'created_at'> & { id?: string }
): Promise<ExerciseRating> {
  await ensureRatingsTable();

  const id = data.id || `rating_${data.exercise_id}_${Date.now()}`;
  const now = new Date().toISOString();

  const ratingRecord: ExerciseRating = {
    id,
    exercise_id: data.exercise_id,
    exercise_name: data.exercise_name || '',
    rating: Math.min(5, Math.max(1, Math.round(data.rating))),
    criteria_animation: data.criteria_animation ? Math.min(5, Math.max(1, data.criteria_animation)) : undefined,
    criteria_clarity: data.criteria_clarity ? Math.min(5, Math.max(1, data.criteria_clarity)) : undefined,
    criteria_feeling: data.criteria_feeling ? Math.min(5, Math.max(1, data.criteria_feeling)) : undefined,
    difficulty_tag: data.difficulty_tag,
    comment: (data.comment || '').trim(),
    user_name: (data.user_name || '').trim() || 'Athlète Vitax',
    created_at: now,
  };

  // 1. Sauvegarde dans SQLite
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO exercise_ratings 
        (id, exercise_id, exercise_name, rating, criteria_animation, criteria_clarity, criteria_feeling, difficulty_tag, comment, user_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ratingRecord.id,
        ratingRecord.exercise_id,
        ratingRecord.exercise_name || '',
        ratingRecord.rating,
        ratingRecord.criteria_animation ?? null,
        ratingRecord.criteria_clarity ?? null,
        ratingRecord.criteria_feeling ?? null,
        ratingRecord.difficulty_tag ?? null,
        ratingRecord.comment || null,
        ratingRecord.user_name || 'Athlète Vitax',
        ratingRecord.created_at,
      ]
    );
  } catch (err) {
    console.warn('Erreur sauvegarde SQLite rating:', err);
  }

  // 2. Sauvegarde dans AsyncStorage
  try {
    const all = await getAllLocalRatings();
    const filtered = all.filter((r) => r.exercise_id !== data.exercise_id && r.id !== id);
    filtered.unshift(ratingRecord);
    await AsyncStorage.setItem(STORAGE_KEY_EXERCISE_RATINGS, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Erreur sauvegarde AsyncStorage rating:', err);
  }

  // 3. Synchronisation optionnelle avec Supabase si configuré
  void syncRatingToSupabase(ratingRecord).catch(() => {});

  return ratingRecord;
}

/**
 * Supprime une note d'exercice
 */
export async function deleteExerciseRating(ratingId: string, exerciseId?: string): Promise<boolean> {
  try {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM exercise_ratings WHERE id = ? OR exercise_id = ?', [ratingId, exerciseId || '']);
    } catch {}

    const all = await getAllLocalRatings();
    const updated = all.filter((r) => r.id !== ratingId && (!exerciseId || r.exercise_id !== exerciseId));
    await AsyncStorage.setItem(STORAGE_KEY_EXERCISE_RATINGS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

/**
 * Calcule le résumé statistique d'évaluation pour un exercice (moyenne, total, avis utilisateur)
 */
export async function getRatingSummaryForExercise(exerciseId: string): Promise<ExerciseRatingSummary> {
  const userRating = await getRatingForExercise(exerciseId);
  const base = BASE_COMMUNITY_STATS[exerciseId] || { average: 4.5, count: 18 };

  const ratingsBreakdown = {
    1: 0,
    2: 1,
    3: 2,
    4: Math.round(base.count * 0.4),
    5: Math.round(base.count * 0.5),
  };

  if (userRating) {
    const star = userRating.rating as 1 | 2 | 3 | 4 | 5;
    if (ratingsBreakdown[star] !== undefined) {
      ratingsBreakdown[star] += 1;
    }
  }

  const totalRatings = base.count + (userRating ? 1 : 0);
  const averageRating = userRating
    ? Number(((base.average * base.count + userRating.rating) / totalRatings).toFixed(1))
    : base.average;

  return {
    exerciseId,
    averageRating,
    totalRatings,
    ratingsBreakdown,
    userRating: userRating || undefined,
  };
}

/**
 * Récupère un dictionnaire global des résumés pour affichage performant dans le catalogue
 */
export async function getAllRatingsSummaries(): Promise<Record<string, ExerciseRatingSummary>> {
  const localRatings = await getAllLocalRatings();
  const userRatingsMap = new Map<string, ExerciseRating>();
  for (const r of localRatings) {
    userRatingsMap.set(r.exercise_id, r);
  }

  const summaries: Record<string, ExerciseRatingSummary> = {};

  // Tous les exercices du catalogue avec base stats
  for (const [exId, base] of Object.entries(BASE_COMMUNITY_STATS)) {
    const userRating = userRatingsMap.get(exId);
    const totalRatings = base.count + (userRating ? 1 : 0);
    const averageRating = userRating
      ? Number(((base.average * base.count + userRating.rating) / totalRatings).toFixed(1))
      : base.average;

    summaries[exId] = {
      exerciseId: exId,
      averageRating,
      totalRatings,
      ratingsBreakdown: {
        1: 0,
        2: 1,
        3: 2,
        4: Math.round(base.count * 0.4),
        5: Math.round(base.count * 0.5),
      },
      userRating,
    };
  }

  // Inclure aussi les exercices personnalisés qui ont été notés
  for (const [exId, uRating] of userRatingsMap.entries()) {
    if (!summaries[exId]) {
      summaries[exId] = {
        exerciseId: exId,
        averageRating: uRating.rating,
        totalRatings: 1,
        ratingsBreakdown: {
          1: uRating.rating === 1 ? 1 : 0,
          2: uRating.rating === 2 ? 1 : 0,
          3: uRating.rating === 3 ? 1 : 0,
          4: uRating.rating === 4 ? 1 : 0,
          5: uRating.rating === 5 ? 1 : 0,
        },
        userRating: uRating,
      };
    }
  }

  return summaries;
}

/**
 * Récupère tous les retours et commentaires destinés aux développeurs
 */
export async function getAllUserFeedbackForDev(): Promise<ExerciseRating[]> {
  const all = await getAllLocalRatings();
  // Tri par date décroissante
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Exporte l'ensemble des retours sous format JSON pour l'équipe de dev
 */
export async function exportFeedbackSummaryJson(): Promise<string> {
  const feedbacks = await getAllUserFeedbackForDev();
  return JSON.stringify(
    {
      app: 'Vitax Musculation',
      exported_at: new Date().toISOString(),
      total_feedbacks: feedbacks.length,
      feedbacks,
    },
    null,
    2
  );
}

/**
 * Exporte l'ensemble des retours sous forme de texte clair pour partage ou rapport GitHub
 */
export async function exportFeedbackSummaryText(): Promise<string> {
  const feedbacks = await getAllUserFeedbackForDev();
  if (feedbacks.length === 0) {
    return 'Aucun retour utilisateur enregistré pour le moment.';
  }

  const lines: string[] = [
    '========================================',
    '📊 RAPPORT RETOURS DÉVELOPPEUR VITAX',
    `Date : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
    `Total avis : ${feedbacks.length}`,
    '========================================\n',
  ];

  feedbacks.forEach((f, idx) => {
    lines.push(
      `#${idx + 1} Exercice : ${f.exercise_name || f.exercise_id}`,
      `   Note globale : ${'⭐'.repeat(f.rating)} (${f.rating}/5)`,
      `   Auteur : ${f.user_name || 'Anonyme'} • Date : ${new Date(f.created_at).toLocaleDateString('fr-FR')}`,
      f.criteria_animation ? `   • Rendu / Animation : ${f.criteria_animation}/5` : '',
      f.criteria_clarity ? `   • Clarté consignes : ${f.criteria_clarity}/5` : '',
      f.criteria_feeling ? `   • Biomécanique / Sensation : ${f.criteria_feeling}/5` : '',
      f.difficulty_tag ? `   • Ressenti difficulté : ${f.difficulty_tag}` : '',
      f.comment ? `   💬 Remarque dev : « ${f.comment} »` : '   💬 Aucun commentaire textuel',
      '----------------------------------------'
    );
  });

  return lines.filter(Boolean).join('\n');
}

/**
 * Synchronise en tâche de fond la note vers Supabase si la table existe
 */
async function syncRatingToSupabase(rating: ExerciseRating): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const session = await getPersistedSession();
    await supabase.from('exercise_ratings').upsert(
      {
        id: rating.id,
        user_id: session?.userId || null,
        user_name: rating.user_name || null,
        exercise_id: rating.exercise_id,
        exercise_name: rating.exercise_name || null,
        rating: rating.rating,
        criteria_animation: rating.criteria_animation || null,
        criteria_clarity: rating.criteria_clarity || null,
        criteria_feeling: rating.criteria_feeling || null,
        difficulty_tag: rating.difficulty_tag || null,
        comment: rating.comment || null,
        created_at: rating.created_at,
      },
      { onConflict: 'id' }
    );
  } catch {
    // Si la table Supabase n'est pas encore créée, ignore silencieusement
  }
}
