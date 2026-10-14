import { getDatabase } from './db';
import { Program, ProgramExerciseDetail, DifficultyLevel } from '../types';

export async function getAllPrograms(): Promise<Program[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Program>(`
    SELECT
      p.*,
      COUNT(pe.id) AS exercises_count,
      GROUP_CONCAT(DISTINCT e.equipment_needed) AS required_equipments
    FROM programs p
    LEFT JOIN program_exercises pe ON pe.program_id = p.id
    LEFT JOIN exercises e ON e.id = pe.exercise_id
    GROUP BY p.id
    ORDER BY p.is_custom DESC, p.name ASC
  `);
  return rows;
}

export async function getProgramById(
  id: string
): Promise<{ program: Program; exercises: ProgramExerciseDetail[] } | null> {
  const db = await getDatabase();
  const program = await db.getFirstAsync<Program>('SELECT * FROM programs WHERE id = ?', [id]);
  if (!program) return null;

  const exercises = await db.getAllAsync<ProgramExerciseDetail>(
    `SELECT
       pe.id,
       pe.program_id,
       pe.exercise_id,
       pe.default_sets,
       pe.default_reps,
       pe.rest_time_seconds,
       pe.order_index,
       e.name,
       e.description,
       e.target_muscle,
       e.equipment_needed
     FROM program_exercises pe
     JOIN exercises e ON e.id = pe.exercise_id
     WHERE pe.program_id = ?
     ORDER BY pe.order_index ASC`,
    [id]
  );

  return { program, exercises };
}

export interface NewProgramInput {
  name: string;
  description: string;
  difficulty_level: DifficultyLevel;
  exercises: {
    exercise_id: string;
    default_sets: number;
    default_reps: number;
    rest_time_seconds: number;
  }[];
}

export async function createCustomProgram(input: NewProgramInput): Promise<string> {
  const db = await getDatabase();
  const programId = `custom_prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO programs (id, name, description, difficulty_level, is_custom, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [programId, input.name, input.description, input.difficulty_level, now]
  );

  for (let i = 0; i < input.exercises.length; i++) {
    const item = input.exercises[i];
    const peId = `${programId}_${item.exercise_id}_${i}`;
    await db.runAsync(
      `INSERT INTO program_exercises (id, program_id, exercise_id, default_sets, default_reps, rest_time_seconds, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        peId,
        programId,
        item.exercise_id,
        item.default_sets,
        item.default_reps,
        item.rest_time_seconds,
        i,
      ]
    );
  }

  return programId;
}

export async function deleteCustomProgram(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM programs WHERE id = ? AND is_custom = 1', [id]);
  return result.changes > 0;
}
