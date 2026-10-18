import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ActiveWorkoutSetItem } from '../../types';
import { Colors } from '../../constants/colors';
import {
  getExerciseUnitInfo,
  convertWeightFromKg,
  KG_TO_LBS_FACTOR,
} from '../../utils/exerciseUnits';
import { useSettingsStore } from '../../stores/settingsStore';

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
  const weightUnit = useSettingsStore((state) => state.weight_unit);
  const unitInfo = getExerciseUnitInfo(exercise);
  const isDuration = unitInfo.isDuration;
  const isLbsMode = !isDuration && weightUnit === 'lbs';

  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const [repsDraft, setRepsDraft] = useState<string | null>(null);

  const displayLoadValue = isLbsMode
    ? convertWeightFromKg(set.weight, 'lbs')
    : set.weight;

  const displayedWeight =
    weightDraft !== null
      ? weightDraft
      : displayLoadValue === 0
      ? ''
      : String(displayLoadValue);
  const displayedReps =
    repsDraft !== null ? repsDraft : set.reps === 0 ? '' : String(set.reps);

  const toInternalKg = (enteredVal: number): number => {
    if (!Number.isFinite(enteredVal) || enteredVal <= 0) return 0;
    if (isLbsMode) {
      return Math.round((enteredVal / KG_TO_LBS_FACTOR) * 100) / 100;
    }
    return Math.round(enteredVal * 100) / 100;
  };

  const handleWeightChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.,]/g, '');
    setWeightDraft(cleaned);
    const val = parseFloat(cleaned.replace(',', '.'));
    onUpdate(isNaN(val) ? 0 : toInternalKg(val), set.reps);
  };

  const handleWeightBlur = () => {
    if (weightDraft !== null) {
      const val = parseFloat(weightDraft.replace(',', '.'));
      const safeVal = isNaN(val) || val < 0 ? 0 : toInternalKg(val);
      onUpdate(safeVal, set.reps);
      setWeightDraft(null);
    }
  };

  const handleRepsChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setRepsDraft(cleaned);
    const val = parseInt(cleaned, 10);
    onUpdate(set.weight, isNaN(val) ? 0 : val);
  };

  const handleRepsBlur = () => {
    if (repsDraft !== null) {
      const val = parseInt(repsDraft, 10);
      const safeVal = isNaN(val) || val < 0 ? 0 : val;
      onUpdate(set.weight, safeVal);
      setRepsDraft(null);
    }
  };

  const weightStep = isDuration
    ? unitInfo.loadUnit === 'km/h'
      ? 0.5
      : 1
    : isLbsMode
    ? 5
    : 2.5;

  const adjustWeight = (multiplier: number) => {
    const delta = multiplier * weightStep;
    const nextDisplay = Math.max(0, Math.round((displayLoadValue + delta) * 10) / 10);
    setWeightDraft(null);
    onUpdate(toInternalKg(nextDisplay), set.reps);
  };

  const adjustReps = (delta: number) => {
    const nextReps = Math.max(0, set.reps + delta);
    setRepsDraft(null);
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
    const prevLoad = isLbsMode
      ? convertWeightFromKg(set.previous_weight || 0, 'lbs')
      : set.previous_weight;
    return `${prevLoad}${unitInfo.loadUnit}×${set.previous_reps}`;
  })();

  const exName = exercise?.name || 'Exercice';

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
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Diminuer ${unitInfo.loadLabel.toLowerCase()} série ${set.set_order} pour ${exName}`}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, set.completed && styles.inputCompleted]}
            keyboardType="decimal-pad"
            value={displayedWeight}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            onChangeText={handleWeightChange}
            onBlur={handleWeightBlur}
            selectTextOnFocus
            accessibilityLabel={`${unitInfo.loadLabel} série ${set.set_order} en ${unitInfo.loadUnit}`}
          />

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustWeight(1)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Augmenter ${unitInfo.loadLabel.toLowerCase()} série ${set.set_order} pour ${exName}`}
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
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Diminuer ${unitInfo.valueLabel.toLowerCase()} série ${set.set_order} pour ${exName}`}
          >
            <Text style={styles.stepBtnText}>-</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, set.completed && styles.inputCompleted]}
            keyboardType="number-pad"
            value={displayedReps}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            onChangeText={handleRepsChange}
            onBlur={handleRepsBlur}
            selectTextOnFocus
            accessibilityLabel={`${unitInfo.valueLabel} série ${set.set_order}`}
          />

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustReps(1)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Augmenter ${unitInfo.valueLabel.toLowerCase()} série ${set.set_order} pour ${exName}`}
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
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={`${set.completed ? 'Série validée' : 'Valider la série'} ${set.set_order} de ${exName}`}
      >
        <Text style={styles.validateIcon}>{set.completed ? '✓' : '○'}</Text>
      </TouchableOpacity>

      {/* Bouton supprimer la série */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onRemove}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer la série ${set.set_order} de ${exName}`}
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
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2B3E',
  },
  rowCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  colSet: {
    width: 44,
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
    marginHorizontal: 3,
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
    width: 30,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202E42',
  },
  stepBtnText: {
    color: Colors.textSecondary,
    fontSize: 17,
    fontWeight: '700',
  },
  input: {
    width: 48,
    height: 40,
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
    color: '#080C14',
  },
  deleteBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  deleteIcon: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '700',
  },
});

