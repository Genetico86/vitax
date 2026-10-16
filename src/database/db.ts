import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import seedData from './seedData.json';

const DATABASE_NAME = 'vitax.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (dbInstance) {
      dbInstance.closeAsync().catch(() => {});
      dbInstance = null;
    }
  });
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const maxAttempts = Platform.OS === 'web' ? 3 : 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
      break;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err || '');
      const isLockError =
        msg.includes('NoModificationAllowed') ||
        msg.includes('Access Handles') ||
        msg.includes('createSyncAccessHandle');

      if (Platform.OS === 'web' && isLockError && attempt < maxAttempts) {
        // Attendre un court instant si l'autre fenêtre est en cours de fermeture
        await new Promise((res) => setTimeout(res, 600 * attempt));
        continue;
      }
      throw err;
    }
  }

  if (!dbInstance) {
    throw lastError || new Error('Impossible d’ouvrir la base de données locale.');
  }

  const activeDb = dbInstance;

  if (Platform.OS !== 'web') {
    await activeDb.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  } else {
    try {
      await activeDb.execAsync('PRAGMA foreign_keys = ON;');
    } catch {
      // Ignoré sur le web si non supporté
    }
  }
  return activeDb;
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(CREATE_TABLES_SQL);

  // Migration douce non-bloquante pour les colonnes ajoutées
  try {
    await db.execAsync('ALTER TABLE pokemon_eggs ADD COLUMN current_pokemon_xp INTEGER NOT NULL DEFAULT 0;');
  } catch {
    // Colonne déjà existante
  }

  // Insérer ou synchroniser les programmes et exercices de base de manière transparente
  await seedDatabase(db);
}

export async function seedDatabase(db?: SQLite.SQLiteDatabase): Promise<void> {
  const targetDb = db || (await getDatabase());

  // Insérer ou mettre à jour les exercices de base
  for (const ex of seedData.exercises) {
    await targetDb.runAsync(
      `INSERT INTO exercises (id, name, description, target_muscle, equipment_needed, is_custom)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         target_muscle = excluded.target_muscle,
         equipment_needed = excluded.equipment_needed`,
      [ex.id, ex.name, ex.description, ex.target_muscle, ex.equipment_needed]
    );
  }

  // Insérer ou mettre à jour les programmes de base
  for (const prog of seedData.programs) {
    await targetDb.runAsync(
      `INSERT INTO programs (id, name, description, difficulty_level, is_custom, created_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         difficulty_level = excluded.difficulty_level`,
      [prog.id, prog.name, prog.description, prog.difficulty_level, new Date().toISOString()]
    );

    // Nettoyer les anciens exercices du programme officiel pour éviter les résidus
    await targetDb.runAsync('DELETE FROM program_exercises WHERE program_id = ?', [prog.id]);

    // Insérer les exercices associés
    for (const pe of prog.exercises) {
      const peId = `${prog.id}_${pe.exercise_id}_${pe.order_index}`;
      await targetDb.runAsync(
        `INSERT INTO program_exercises (id, program_id, exercise_id, default_sets, default_reps, rest_time_seconds, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           default_sets = excluded.default_sets,
           default_reps = excluded.default_reps,
           rest_time_seconds = excluded.rest_time_seconds,
           order_index = excluded.order_index`,
        [
          peId,
          prog.id,
          pe.exercise_id,
          pe.default_sets,
          pe.default_reps,
          pe.rest_time_seconds,
          pe.order_index,
        ]
      );
    }
  }

  // Marquer comme seedé
  await targetDb.runAsync(
    `INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seeded', 'true')`
  );
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS fitness_goals;
    DROP TABLE IF EXISTS body_weights;
    DROP TABLE IF EXISTS pokemon_eggs;
    DROP TABLE IF EXISTS workout_sets;
    DROP TABLE IF EXISTS workout_sessions;
    DROP TABLE IF EXISTS program_exercises;
    DROP TABLE IF EXISTS programs;
    DROP TABLE IF EXISTS exercises;
    DROP TABLE IF EXISTS app_metadata;
  `);
  await initDatabase();
}
