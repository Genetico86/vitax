import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BodyWeightLog } from '../../types';
import { useWeightGoals } from './hooks/useWeightGoals';
import { WeightSummaryCard } from './sections/WeightSummaryCard';
import { PhysiologicalStatsCard } from './sections/PhysiologicalStatsCard';
import { WeightHistoryChart } from './sections/WeightHistoryChart';
import { WeightGoalCard } from './sections/WeightGoalCard';
import { StrengthGoalsSection } from './sections/StrengthGoalsSection';
import { WeightHistoryList } from './sections/WeightHistoryList';
import { WeightLogModal } from './modals/WeightLogModal';
import { WeightGoalModal } from './modals/WeightGoalModal';
import { StrengthGoalModal } from './modals/StrengthGoalModal';
import { HeightModal } from './modals/HeightModal';
import { useSettingsStore } from '../../stores/settingsStore';

interface WeightGoalsViewProps {
  onWeightUpdated?: () => void;
}

export const WeightGoalsView: React.FC<WeightGoalsViewProps> = ({ onWeightUpdated }) => {
  const { user_height_cm, setUserHeight } = useSettingsStore();

  const {
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
  } = useWeightGoals(onWeightUpdated);

  // Modales
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<BodyWeightLog | null>(null);

  const [weightGoalModalVisible, setWeightGoalModalVisible] = useState(false);
  const [strengthGoalModalVisible, setStrengthGoalModalVisible] = useState(false);
  const [heightModalVisible, setHeightModalVisible] = useState(false);

  const handleOpenAddLog = () => {
    setEditingLog(null);
    setLogModalVisible(true);
  };

  const handleOpenEditLog = (item: BodyWeightLog) => {
    setEditingLog(item);
    setLogModalVisible(true);
  };

  const handleSaveHeight = async (heightVal: number) => {
    await setUserHeight(heightVal);
    onWeightUpdated?.();
  };

  return (
    <View style={styles.container}>
      {/* 1. Carte Résumé Poids */}
      <WeightSummaryCard
        stats={stats}
        weightUnit={weight_unit}
        userHeightCm={user_height_cm}
        onAddLogPress={handleOpenAddLog}
        onSetHeightPress={() => setHeightModalVisible(true)}
      />

      {/* 2. Analyse Physiologique & IMC Complète */}
      <PhysiologicalStatsCard
        stats={stats}
        userHeightCm={user_height_cm}
        weightUnit={weight_unit}
        onSetHeightPress={() => setHeightModalVisible(true)}
        onAddLogPress={handleOpenAddLog}
      />

      {/* 2. Mini-Graphique d'historique des dernières pesées */}
      <WeightHistoryChart chartLogs={chartLogs} />

      {/* 3. Carte Objectif de Poids */}
      <WeightGoalCard
        weightGoal={weightGoal}
        weightGoalProgress={weightGoalProgress}
        currentWeight={stats?.currentWeight}
        onSetOrEditGoalPress={() => setWeightGoalModalVisible(true)}
      />

      {/* 4. Section Objectifs de Force & Musculation */}
      <StrengthGoalsSection
        goals={goals}
        onAddGoalPress={() => setStrengthGoalModalVisible(true)}
        onDeleteGoal={handleDeleteGoal}
      />

      {/* 5. Historique détaillé des pesées */}
      <WeightHistoryList
        logs={logs}
        weightUnit={weight_unit}
        onEditLog={handleOpenEditLog}
        onDeleteLog={handleDeleteLog}
      />

      {/* Modale d'enregistrement / édition de pesée */}
      <WeightLogModal
        visible={logModalVisible}
        editingLog={editingLog}
        weightUnit={weight_unit}
        defaultWeight={stats?.currentWeight}
        onClose={() => setLogModalVisible(false)}
        onSave={handleSaveLog}
      />

      {/* Modale d'objectif de poids */}
      <WeightGoalModal
        visible={weightGoalModalVisible}
        weightUnit={weight_unit}
        initialTarget={weightGoal?.target_value}
        initialStarting={weightGoal?.starting_value ?? stats?.currentWeight}
        onClose={() => setWeightGoalModalVisible(false)}
        onSave={handleSaveWeightGoal}
      />

      {/* Modale d'objectif de force */}
      <StrengthGoalModal
        visible={strengthGoalModalVisible}
        weightUnit={weight_unit}
        exercises={exercises}
        onClose={() => setStrengthGoalModalVisible(false)}
        onSave={handleSaveStrengthGoal}
      />

      {/* Modale de saisie / modification de la taille */}
      <HeightModal
        visible={heightModalVisible}
        currentHeight={user_height_cm}
        onClose={() => setHeightModalVisible(false)}
        onSave={handleSaveHeight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
});
