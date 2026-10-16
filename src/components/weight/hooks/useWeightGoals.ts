import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { BodyWeightLog, FitnessGoal, WeightProgressStats, Exercise } from '../../../types';
import {
  getAllWeightLogs,
  addWeightLog,
  deleteWeightLog,
  getWeightStats,
} from '../../../database/weightRepository';
import {
  getAllGoals,
  getTargetWeightGoal,
  setTargetWeightGoal,
  createGoal,
  deleteGoal,
  syncGoalsWithUserRecords,
} from '../../../database/goalRepository';
import { getAllExercises } from '../../../database/exerciseRepository';
import { useSettingsStore } from '../../../stores/settingsStore';

export function useWeightGoals(onWeightUpdated?: () => void) {
  const { user_height_cm, weight_unit } = useSettingsStore();

  const [logs, setLogs] = useState<BodyWeightLog[]>([]);
  const [stats, setStats] = useState<WeightProgressStats | null>(null);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [weightGoal, setWeightGoal] = useState<FitnessGoal | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const loadData = useCallback(async () => {
    try {
      await syncGoalsWithUserRecords();

      const [allLogs, weightSt, allGoals, targetGoal, allEx] = await Promise.all([
        getAllWeightLogs(),
        getWeightStats(user_height_cm),
        getAllGoals(),
        getTargetWeightGoal(),
        getAllExercises(),
      ]);

      setLogs(allLogs);
      setStats(weightSt);
      setGoals(allGoals.filter((g) => g.category !== 'weight'));
      setWeightGoal(targetGoal);
      setExercises(allEx);
    } catch (err) {
      console.error('Erreur chargement suivi poids & objectifs:', err);
    }
  }, [user_height_cm]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (isMounted) {
        await loadData();
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  // Ajouter ou modifier une pesée historisée
  const handleSaveLog = async (
    weightVal: number,
    dateVal: string,
    noteVal?: string,
    bodyFatVal?: number
  ) => {
    await addWeightLog(weightVal, dateVal, noteVal, bodyFatVal);
    await loadData();
    onWeightUpdated?.();
  };

  // Supprimer une pesée
  const handleDeleteLog = (id: string, weight: number, date: string) => {
    Alert.alert(
      'Supprimer cette pesée',
      `Voulez-vous supprimer la pesée de ${weight} kg du ${date} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteWeightLog(id);
            await loadData();
            onWeightUpdated?.();
          },
        },
      ]
    );
  };

  // Enregistrer objectif de poids
  const handleSaveWeightGoal = async (target: number, starting?: number) => {
    await setTargetWeightGoal(target, starting);
    await loadData();
    onWeightUpdated?.();
  };

  // Enregistrer objectif de force
  const handleSaveStrengthGoal = async (exerciseId: string, targetWeight: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    const title = ex ? `${ex.name} à ${targetWeight} kg` : `Objectif ${targetWeight} kg`;

    await createGoal({
      title,
      category: 'exercise',
      target_value: targetWeight,
      starting_value: 0,
      unit: weight_unit,
      exercise_id: exerciseId,
    });

    await loadData();
  };

  // Supprimer un objectif
  const handleDeleteGoal = (id: string, title: string) => {
    Alert.alert('Supprimer cet objectif', `Voulez-vous supprimer « ${title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(id);
          await loadData();
        },
      },
    ]);
  };

  // Calcul progression objectif de poids
  const weightGoalProgress = useMemo(() => {
    if (!weightGoal || !stats?.currentWeight) return null;

    const start = weightGoal.starting_value;
    const target = weightGoal.target_value;
    const current = stats.currentWeight;

    const isLosing = start > target;
    const totalDiff = Math.abs(start - target);
    const currentDiff = isLosing ? start - current : current - start;
    const remainingKg = Math.abs(current - target);

    let percent = totalDiff > 0 ? (currentDiff / totalDiff) * 100 : 0;
    percent = Math.max(0, Math.min(100, Math.round(percent)));

    const achieved = isLosing ? current <= target : current >= target;

    return {
      percent,
      isLosing,
      remainingKg: Math.round(remainingKg * 10) / 10,
      achieved,
    };
  }, [weightGoal, stats]);

  // Données de graphique (12 dernières pesées inversées chronologiquement)
  const chartLogs = useMemo(() => {
    return [...logs].slice(0, 12).reverse();
  }, [logs]);

  return {
    logs,
    stats,
    goals,
    weightGoal,
    exercises,
    weight_unit,
    weightGoalProgress,
    chartLogs,
    handleSaveLog,
    handleDeleteLog,
    handleSaveWeightGoal,
    handleSaveStrengthGoal,
    handleDeleteGoal,
    reload: loadData,
  };
}
