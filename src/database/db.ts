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

const SCHEMA_VERSION = '3';
const SEED_CATALOG_VERSION = `v2_${seedData.exercises.length}_${seedData.programs.length}`;

/**
 * Exécute un bloc d'opérations SQLite dans une transaction atomique
 * en évitant les transactions imbriquées si une transaction est déjà active.
 */
export async function runInTransaction(
  db: SQLite.SQLiteDatabase,
  task: () => Promise<void>
): Promise<void> {
  let alreadyInTx = false;
  try {
    alreadyInTx = await db.isInTransactionAsync();
  } catch {
    alreadyInTx = false;
  }

  if (alreadyInTx) {
    await task();
  } else {
    await db.withTransactionAsync(task);
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(CREATE_TABLES_SQL);

  // Vérifier la version du schéma pour n'exécuter les migrations qu'en cas de besoin
  const schemaMeta = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'schema_version'"
  );

  if (schemaMeta?.value !== SCHEMA_VERSION) {
    // Suppression définitive de l'ancienne table pokemon_eggs si présente
    try {
      await db.execAsync('DROP TABLE IF EXISTS pokemon_eggs;');
    } catch {}

    await db.runAsync(
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('schema_version', ?)",
      [SCHEMA_VERSION]
    );
  }

  // Vérifier si le catalogue de base est déjà à jour pour éviter ~215 requêtes à chaque démarrage
  const seedMeta = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'seed_version'"
  );
  const exCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(id) AS count FROM exercises WHERE is_custom = 0'
  );

  if (
    seedMeta?.value !== SEED_CATALOG_VERSION ||
    !exCountRow ||
    exCountRow.count < seedData.exercises.length
  ) {
    await seedDatabase(db);
  }
}

export async function seedDatabase(db?: SQLite.SQLiteDatabase): Promise<void> {
  const targetDb = db || (await getDatabase());
  const nowIso = new Date().toISOString();

  await runInTransaction(targetDb, async () => {
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
        [prog.id, prog.name, prog.description, prog.difficulty_level, nowIso]
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

    // Marquer comme seedé avec la version exacte du catalogue
    await targetDb.runAsync(
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seeded', 'true')"
    );
    await targetDb.runAsync(
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('seed_version', ?)",
      [SEED_CATALOG_VERSION]
    );
  });
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS exercise_favorites;
    DROP TABLE IF EXISTS running_sessions;
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

/**
 * Purge uniquement les données propres à l'utilisateur (lors d'une déconnexion ou d'un changement de compte)
 * tout en conservant le catalogue des 107 exercices et des 15 programmes de base.
 */
export async function clearUserLocalData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM exercise_favorites;
    DELETE FROM workout_sets;
    DELETE FROM workout_sessions;
    DELETE FROM body_weights;
    DELETE FROM fitness_goals;
    DELETE FROM running_sessions;
    DELETE FROM program_exercises WHERE program_id IN (SELECT id FROM programs WHERE is_custom = 1);
    DELETE FROM programs WHERE is_custom = 1;
    DELETE FROM exercises WHERE is_custom = 1;
  `);
}

