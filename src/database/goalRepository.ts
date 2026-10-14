import { getDatabase } from './db';
import { FitnessGoal, GoalCategory } from '../types';
import { getLatestWeightLog } from './weightRepository';

export async function getAllGoals(): Promise<FitnessGoal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FitnessGoal>(`
    SELECT
      g.*,
      e.name AS exercise_name
    FROM fitness_goals g
    LEFT JOIN exercises e ON e.id = g.exercise_id
    ORDER BY g.completed ASC, g.created_at DESC
  `);
  return rows;
}

export async function getTargetWeightGoal(): Promise<FitnessGoal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FitnessGoal>(
    "SELECT * FROM fitness_goals WHERE category = 'weight' ORDER BY created_at DESC LIMIT 1"
  );
  return row || null;
}

export async function setTargetWeightGoal(
  targetWeight: number,
  startingWeight?: number,
  targetDate?: string
): Promise<string> {
  const db = await getDatabase();
  const latestLog = await getLatestWeightLog();
  const initialWeight = startingWeight ?? (latestLog ? latestLog.weight : targetWeight);
  const currentWeight = latestLog ? latestLog.weight : initialWeight;
  const now = new Date().toISOString();

  // Vérifier si un objectif de poids existe déjà
  const existing = await getTargetWeightGoal();

  const isCompleted =
    (initialWeight > targetWeight && currentWeight <= targetWeight) ||
    (initialWeight < targetWeight && currentWeight >= targetWeight);

  if (existing) {
    await db.runAsync(
      `UPDATE fitness_goals
       SET target_value = ?, starting_value = ?, current_value = ?, target_date = ?, completed = ?, completed_at = ?
       WHERE id = ?`,
      [
        targetWeight,
        initialWeight,
        currentWeight,
        targetDate || null,
        isCompleted ? 1 : 0,
        isCompleted ? now : null,
        existing.id,
      ]
    );
    return existing.id;
  }

  const id = `goal_weight_${Date.now()}`;
  await db.runAsync(
    `INSERT INTO fitness_goals (
       id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
     ) VALUES (?, ?, 'weight', ?, ?, ?, 'kg', ?, NULL, ?, ?, ?)`,
    [
      id,
      `Poids cible : ${targetWeight} kg`,
      targetWeight,
      initialWeight,
      currentWeight,
      targetDate || null,
      isCompleted ? 1 : 0,
      isCompleted ? now : null,
      now,
    ]
  );

  return id;
}

export async function createGoal(input: {
  title: string;
  category: GoalCategory;
  target_value: number;
  starting_value: number;
  current_value?: number;
  unit?: string;
  target_date?: string;
  exercise_id?: string;
}): Promise<string> {
  const db = await getDatabase();
  const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const currentValue = input.current_value ?? input.starting_value;
  const unit = input.unit || 'kg';

  const isCompleted = currentValue >= input.target_value;

  await db.runAsync(
    `INSERT INTO fitness_goals (
       id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.category,
      input.target_value,
      input.starting_value,
      currentValue,
      unit,
      input.target_date || null,
      input.exercise_id || null,
      isCompleted ? 1 : 0,
      isCompleted ? now : null,
      now,
    ]
  );

  return id;
}

export async function updateGoalProgress(id: string, currentValue: number): Promise<boolean> {
  const db = await getDatabase();
  const goal = await db.getFirstAsync<FitnessGoal>(
    'SELECT * FROM fitness_goals WHERE id = ?',
    [id]
  );
  if (!goal) return false;

  let isCompleted = false;
  if (goal.category === 'weight') {
    if (goal.starting_value > goal.target_value) {
      isCompleted = currentValue <= goal.target_value;
    } else {
      isCompleted = currentValue >= goal.target_value;
    }
  } else {
    isCompleted = currentValue >= goal.target_value;
  }

  const completedAt = isCompleted ? new Date().toISOString() : null;

  const res = await db.runAsync(
    `UPDATE fitness_goals
     SET current_value = ?, completed = ?, completed_at = ?
     WHERE id = ?`,
    [currentValue, isCompleted ? 1 : 0, completedAt, id]
  );

  return res.changes > 0;
}

export async function deleteGoal(id: string): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM fitness_goals WHERE id = ?', [id]);
  return res.changes > 0;
}

/**
 * Synchronise automatiquement les objectifs de force et de poids avec les données actuelles de l'utilisateur
 */
export async function syncGoalsWithUserRecords(): Promise<void> {
  const db = await getDatabase();
  const goals = await db.getAllAsync<FitnessGoal>('SELECT * FROM fitness_goals');

  // Sync objectif de poids avec dernière pesée
  const latestWeight = await getLatestWeightLog();
  if (latestWeight) {
    const weightGoal = goals.find((g) => g.category === 'weight');
    if (weightGoal) {
      await updateGoalProgress(weightGoal.id, latestWeight.weight);
    }
  }

  // Sync objectifs de charge d'exercices avec max soulevé
  for (const goal of goals) {
    if (goal.category === 'exercise' && goal.exercise_id) {
      const maxRow = await db.getFirstAsync<{ max_weight: number | null }>(
        `SELECT MAX(weight) AS max_weight
         FROM workout_sets
         WHERE exercise_id = ? AND completed = 1`,
        [goal.exercise_id]
      );
      if (maxRow && maxRow.max_weight !== null && maxRow.max_weight > 0) {
        if (maxRow.max_weight !== goal.current_value) {
          await updateGoalProgress(goal.id, maxRow.max_weight);
        }
      }
    }
  }
}
