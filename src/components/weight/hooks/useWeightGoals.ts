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
import {
  WeightGoalType,
  parseWeightGoalTitle,
  analyzeWeightProgression,
  WeightProgressionFeedback,
} from '../../../utils/physiologyUtils';

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

  // Enregistrer objectif de poids avec son type explicite
  const handleSaveWeightGoal = async (
    target: number,
    starting?: number,
    goalType?: WeightGoalType
  ) => {
    await setTargetWeightGoal(target, starting, undefined, goalType);
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

  // Décoder les informations de l'objectif de poids actuel
  const weightGoalInfo = useMemo(() => {
    if (!weightGoal) return null;
    return parseWeightGoalTitle(weightGoal.title);
  }, [weightGoal]);

  // Analyse d'évolution scientifique et nuancée
  const weightProgressionAnalysis = useMemo((): WeightProgressionFeedback | null => {
    if (!stats?.currentWeight) return null;

    const previousLog = logs[1];
    const goalType = weightGoalInfo?.goalType;

    return analyzeWeightProgression({
      currentWeight: stats.currentWeight,
      startingWeight: weightGoal?.starting_value ?? stats.startingWeight,
      targetWeight: weightGoal?.target_value ?? stats.currentWeight,
      previousWeight: previousLog?.weight ?? stats.startingWeight,
      explicitGoalType: goalType,
      currentBodyFat: stats.latestBodyFat,
      previousBodyFat: previousLog?.body_fat_percentage,
    });
  }, [stats, weightGoal, weightGoalInfo, logs]);

  // Progression de l'objectif de poids
  const weightGoalProgress = useMemo(() => {
    if (!weightGoal || !stats?.currentWeight) return null;

    const analysis = weightProgressionAnalysis;
    return {
      percent: analysis?.progressPercent ?? 0,
      isLosing: analysis?.goalType === 'loss',
      goalType: analysis?.goalType || 'loss',
      goalLabel: analysis?.goalLabel || 'Sèche / Perte',
      remainingKg: analysis?.remainingKg ?? 0,
      achieved: analysis?.isAchieved ?? false,
      feedback: analysis,
    };
  }, [weightGoal, stats, weightProgressionAnalysis]);

  // Données de graphique (12 dernières pesées inversées chronologiquement)
  const chartLogs = useMemo(() => {
    return [...logs].slice(0, 12).reverse();
  }, [logs]);

  return {
    logs,
    stats,
    goals,
    weightGoal,
    weightGoalInfo,
    exercises,
    weight_unit,
    weightGoalProgress,
    weightProgressionAnalysis,
    chartLogs,
    handleSaveLog,
    handleDeleteLog,
    handleSaveWeightGoal,
    handleSaveStrengthGoal,
    handleDeleteGoal,
  };
}
