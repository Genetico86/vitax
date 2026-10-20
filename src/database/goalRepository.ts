import { getDatabase, runInTransaction } from './db';
import { FitnessGoal, GoalCategory } from '../types';
import { getLatestWeightLog } from './weightRepository';
import { syncFitnessGoalToCloud, fetchFitnessGoalsFromCloud } from '../services/cloudSyncService';
import { WeightGoalType, formatWeightGoalTitle } from '../utils/physiologyUtils';

export async function getAllGoals(): Promise<FitnessGoal[]> {
  const db = await getDatabase();
  let rows = await db.getAllAsync<FitnessGoal>(`
    SELECT
      g.*,
      e.name AS exercise_name
    FROM fitness_goals g
    LEFT JOIN exercises e ON e.id = g.exercise_id
    ORDER BY g.completed ASC, g.created_at DESC
  `);

  if (rows.length === 0) {
    try {
      const cloudGoals = await fetchFitnessGoalsFromCloud();
      if (cloudGoals.length > 0) {
        await runInTransaction(db, async () => {
          for (const g of cloudGoals) {
            await db.runAsync(
              `INSERT OR REPLACE INTO fitness_goals (
                 id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                g.id,
                g.title,
                g.category,
                g.target_value,
                g.starting_value || 0,
                g.current_value,
                g.unit || 'kg',
                g.target_date || null,
                g.exercise_id || null,
                g.completed ? 1 : 0,
                g.completed_at || null,
                g.created_at || new Date().toISOString(),
              ]
            );
          }
        });
        rows = await db.getAllAsync<FitnessGoal>(`
          SELECT
            g.*,
            e.name AS exercise_name
          FROM fitness_goals g
          LEFT JOIN exercises e ON e.id = g.exercise_id
          ORDER BY g.completed ASC, g.created_at DESC
        `);
      }
    } catch (err) {
      console.warn('Erreur synchro cloud objectifs:', err);
    }
  }

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
  targetDate?: string,
  goalType?: WeightGoalType
): Promise<string> {
  const db = await getDatabase();
  const latestLog = await getLatestWeightLog();
  const initialWeight = startingWeight ?? (latestLog ? latestLog.weight : targetWeight);
  const currentWeight = latestLog ? latestLog.weight : initialWeight;
  const now = new Date().toISOString();

  // Déterminer le type d'objectif
  const resolvedGoalType: WeightGoalType =
    goalType ||
    (initialWeight > targetWeight ? 'loss' : initialWeight < targetWeight ? 'bulk' : 'maintain');

  const title = formatWeightGoalTitle(targetWeight, resolvedGoalType);

  // Vérifier si un objectif de poids existe déjà
  const existing = await getTargetWeightGoal();

  let isCompleted = false;
  if (resolvedGoalType === 'maintain') {
    isCompleted = Math.abs(currentWeight - targetWeight) <= 1.5;
  } else if (resolvedGoalType === 'bulk') {
    isCompleted = currentWeight >= targetWeight;
  } else {
    isCompleted = currentWeight <= targetWeight;
  }

  if (existing) {
    await db.runAsync(
      `UPDATE fitness_goals
       SET title = ?, target_value = ?, starting_value = ?, current_value = ?, target_date = ?, completed = ?, completed_at = ?
       WHERE id = ?`,
      [
        title,
        targetWeight,
        initialWeight,
        currentWeight,
        targetDate || null,
        isCompleted ? 1 : 0,
        isCompleted ? now : null,
        existing.id,
      ]
    );

    void syncFitnessGoalToCloud({
      ...existing,
      title,
      target_value: targetWeight,
      current_value: currentWeight,
      target_date: targetDate,
      completed: isCompleted ? 1 : 0,
    });

    return existing.id;
  }

  const id = `goal_weight_${Date.now()}`;
  await db.runAsync(
    `INSERT INTO fitness_goals (
       id, title, category, target_value, starting_value, current_value, unit, target_date, exercise_id, completed, completed_at, created_at
     ) VALUES (?, ?, 'weight', ?, ?, ?, 'kg', ?, NULL, ?, ?, ?)`,
    [
      id,
      title,
      targetWeight,
      initialWeight,
      currentWeight,
      targetDate || null,
      isCompleted ? 1 : 0,
      isCompleted ? now : null,
      now,
    ]
  );

  void syncFitnessGoalToCloud({
    id,
    title,
    category: 'weight',
    target_value: targetWeight,
    starting_value: initialWeight,
    current_value: currentWeight,
    unit: 'kg',
    target_date: targetDate,
    completed: isCompleted ? 1 : 0,
    created_at: now,
  });

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

  void syncFitnessGoalToCloud({
    id,
    title: input.title,
    category: input.category,
    target_value: input.target_value,
    starting_value: input.starting_value,
    current_value: currentValue,
    unit,
    target_date: input.target_date,
    exercise_id: input.exercise_id,
    completed: isCompleted ? 1 : 0,
    created_at: now,
  });

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

  if (res.changes > 0) {
    void syncFitnessGoalToCloud({
      ...goal,
      current_value: currentValue,
      completed: isCompleted ? 1 : 0,
      completed_at: completedAt || undefined,
    });
  }

  return res.changes > 0;
}

export async function deleteGoal(id: string): Promise<boolean> {
  const db = await getDatabase();
  const res = await db.runAsync('DELETE FROM fitness_goals WHERE id = ?', [id]);
  if (res.changes > 0) {
    const { deleteFitnessGoalFromCloud } = await import('../services/cloudSyncService');
    void deleteFitnessGoalFromCloud(id);
  }
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
    if (weightGoal && weightGoal.current_value !== latestWeight.weight) {
      await updateGoalProgress(weightGoal.id, latestWeight.weight);
    }
  }

  // Sync objectifs de charge d'exercices avec max soulevé en une seule requête SQL groupée
  const exerciseGoals = goals.filter((g) => g.category === 'exercise' && g.exercise_id);
  if (exerciseGoals.length > 0) {
    const exerciseIds = Array.from(new Set(exerciseGoals.map((g) => g.exercise_id!)));
    const placeholders = exerciseIds.map(() => '?').join(',');
    const maxRows = await db.getAllAsync<{ exercise_id: string; max_weight: number | null }>(
      `SELECT exercise_id, MAX(weight) AS max_weight
       FROM workout_sets
       WHERE exercise_id IN (${placeholders})
         AND (completed = 1 OR completed = '1' OR completed = true OR completed IS NULL)
       GROUP BY exercise_id`,
      exerciseIds
    );

    const maxMap = new Map<string, number>();
    for (const r of maxRows) {
      if (r.max_weight !== null && r.max_weight > 0) {
        maxMap.set(r.exercise_id, r.max_weight);
      }
    }

    for (const goal of exerciseGoals) {
      const maxWeight = maxMap.get(goal.exercise_id!);
      if (maxWeight !== undefined && maxWeight !== goal.current_value) {
        await updateGoalProgress(goal.id, maxWeight);
      }
    }
  }
}
