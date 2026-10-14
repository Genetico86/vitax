import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ActiveWorkoutSetItem } from '../../types';
import { Colors } from '../../constants/colors';
import { getExerciseUnitInfo } from '../../utils/exerciseUnits';

interface ExerciseSetRowProps {
  set: ActiveWorkoutSetItem;
  exerciseIndex: number;
  setIndex: number;
  exercise?: {
    id?: string;
    name?: string;
    equipment_needed?: string;
  };
  onUpdate: (weight: number, reps: number) => void;
  onToggleComplete: () => void;
  onRemove: () => void;
}

export const ExerciseSetRow: React.FC<ExerciseSetRowProps> = ({
  set,
  exercise,
  onUpdate,
  onToggleComplete,
  onRemove,
}) => {
  const unitInfo = getExerciseUnitInfo(exercise);
  const isDuration = unitInfo.isDuration;

  const handleWeightChange = (text: string) => {
    const val = parseFloat(text.replace(',', '.'));
    onUpdate(isNaN(val) ? 0 : val, set.reps);
  };

  const handleRepsChange = (text: string) => {
    const val = parseInt(text, 10);
    onUpdate(set.weight, isNaN(val) ? 0 : val);
  };

  const weightStep = isDuration
    ? unitInfo.loadUnit === 'km/h'
      ? 0.5
      : 1
    : 2.5;

  const adjustWeight = (multiplier: number) => {
    const delta = multiplier * weightStep;
    const nextWeight = Math.max(0, Math.round((set.weight + delta) * 10) / 10);
    onUpdate(nextWeight, set.reps);
  };

  const adjustReps = (delta: number) => {
    const nextReps = Math.max(0, set.reps + delta);
    onUpdate(set.weight, nextReps);
  };

  const hasPrevious = set.previous_weight !== undefined && set.previous_reps !== undefined;

  const previousSummary = (() => {
    if (!hasPrevious) return '';
    if (isDuration) {
      return set.previous_weight && set.previous_weight > 0
        ? `${set.previous_reps}min@${set.previous_weight}`
        : `${set.previous_reps}min`;
    }
    return `${set.previous_weight}kg×${set.previous_reps}`;
  })();

  return (
    <View
      style={[
        styles.rowContainer,
        set.completed && styles.rowCompleted,
      ]}
    >
      {/* Numéro de la série */}
      <View style={styles.colSet}>
        <Text style={[styles.setNumberText, set.completed && styles.completedText]}>
          {set.set_order}
        </Text>
        {hasPrevious && (
          <Text style={styles.previousText} numberOfLines={1}>
            {previousSummary}
          </Text>
        )}
      </View>

      {/* Colonne Poids / Vitesse / Résistance */}
      <View style={styles.colInput}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustWeight(-1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, set.completed && styles.inputCompleted]}
            keyboardType="decimal-pad"
            value={set.weight === 0 ? '' : set.weight.toString()}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            onChangeText={handleWeightChange}
            selectTextOnFocus
          />

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustWeight(1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.inputUnit}>{unitInfo.loadUnit}</Text>
      </View>

      {/* Colonne Répétitions ou Minutes */}
      <View style={styles.colInput}>
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustReps(-1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, set.completed && styles.inputCompleted]}
            keyboardType="number-pad"
            value={set.reps === 0 ? '' : set.reps.toString()}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            onChangeText={handleRepsChange}
            selectTextOnFocus
          />

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustReps(1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.inputUnit}>{unitInfo.valueUnit}</Text>
      </View>

      {/* Gros bouton tactile de validation */}
      <TouchableOpacity
        style={[styles.validateBtn, set.completed && styles.validateBtnCompleted]}
        onPress={onToggleComplete}
        activeOpacity={0.8}
      >
        <Text style={styles.validateIcon}>{set.completed ? '✓' : '○'}</Text>
      </TouchableOpacity>

      {/* Bouton supprimer la série */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onRemove}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteIcon}>×</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121A28',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2B3E',
  },
  rowCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  colSet: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  completedText: {
    color: Colors.success,
  },
  previousText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  colInput: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182436',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#24354D',
  },
  stepBtn: {
    width: 26,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202E42',
  },
  stepBtnText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    width: 44,
    height: 38,
    textAlign: 'center',
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
  },
  inputCompleted: {
    color: Colors.success,
  },
  inputUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  validateBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A2638',
    borderWidth: 2,
    borderColor: '#2C3E56',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  validateBtnCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.successLight,
  },
  validateIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  deleteIcon: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '700',
  },
});
