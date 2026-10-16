import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BodyWeightLog } from '../../types';
import { useWeightGoals } from './hooks/useWeightGoals';
import { WeightSummaryCard } from './sections/WeightSummaryCard';
import { WeightHistoryChart } from './sections/WeightHistoryChart';
import { WeightGoalCard } from './sections/WeightGoalCard';
import { StrengthGoalsSection } from './sections/StrengthGoalsSection';
import { WeightHistoryList } from './sections/WeightHistoryList';
import { WeightLogModal } from './modals/WeightLogModal';
import { WeightGoalModal } from './modals/WeightGoalModal';
import { StrengthGoalModal } from './modals/StrengthGoalModal';

interface WeightGoalsViewProps {
  onWeightUpdated?: () => void;
}

export const WeightGoalsView: React.FC<WeightGoalsViewProps> = ({ onWeightUpdated }) => {
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

  const handleOpenAddLog = () => {
    setEditingLog(null);
    setLogModalVisible(true);
  };

  const handleOpenEditLog = (item: BodyWeightLog) => {
    setEditingLog(item);
    setLogModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* 1. Carte Résumé */}
      <WeightSummaryCard
        stats={stats}
        weightUnit={weight_unit}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
});
