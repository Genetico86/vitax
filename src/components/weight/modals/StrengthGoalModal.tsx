import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { Exercise } from '../../../types';

interface StrengthGoalModalProps {
  visible: boolean;
  weightUnit: string;
  exercises: Exercise[];
  onClose: () => void;
  onSave: (exerciseId: string, targetWeight: number) => Promise<void>;
}

export const StrengthGoalModal: React.FC<StrengthGoalModalProps> = ({
  visible,
  weightUnit,
  exercises,
  onClose,
  onSave,
}) => {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    exercises[0]?.id || ''
  );
  const [targetStrengthWeightInput, setTargetStrengthWeightInput] = useState('');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const filteredExercises = useMemo(() => {
    if (!exerciseSearchQuery.trim()) return exercises;
    const q = exerciseSearchQuery.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.target_muscle.toLowerCase().includes(q)
    );
  }, [exercises, exerciseSearchQuery]);

  const handleSave = async () => {
    const target = parseFloat(targetStrengthWeightInput.replace(',', '.'));
    if (isNaN(target) || target <= 0) {
      Alert.alert('Charge invalide', 'Veuillez entrer une charge cible valide (ex: 100 kg).');
      return;
    }

    const exId = selectedExerciseId || exercises[0]?.id;
    if (!exId) {
      Alert.alert('Exercice requis', 'Veuillez sélectionner un exercice.');
      return;
    }

    await onSave(exId, target);
    setTargetStrengthWeightInput('');
    setExerciseSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { maxHeight: '85%' }]}>
          <Text style={styles.modalTitle}>💪 Nouvel Objectif de Force</Text>
          <Text style={styles.modalSubtitle}>
            Choisissez un exercice et fixez la charge que vous visez à soulever.
          </Text>

          <Text style={styles.inputLabel}>Exercice concerné</Text>

          {/* Barre de recherche d'exercice */}
          <View style={styles.exerciseSearchBox}>
            <TextInput
              style={styles.exerciseSearchField}
              placeholder="🔍 Rechercher (ex: Développé, Squat, Tirage...)"
              placeholderTextColor={Colors.textMuted}
              value={exerciseSearchQuery}
              onChangeText={setExerciseSearchQuery}
              autoCapitalize="none"
            />
            {exerciseSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setExerciseSearchQuery('')}
                style={styles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
            {filteredExercises.length === 0 ? (
              <Text style={styles.noExerciseFoundText}>
                Aucun exercice trouvé pour « {exerciseSearchQuery} »
              </Text>
            ) : (
              filteredExercises.map((ex) => {
                const isSelected = (selectedExerciseId || exercises[0]?.id) === ex.id;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.exerciseChoicePill,
                      isSelected && styles.exerciseChoicePillActive,
                    ]}
                    onPress={() => setSelectedExerciseId(ex.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.exerciseChoiceText,
                          isSelected && styles.exerciseChoiceTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {ex.name}
                      </Text>
                      <Text style={styles.exerciseChoiceMuscleSub}>
                        {ex.target_muscle} • {ex.equipment_needed}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{ color: Colors.primary, fontWeight: '800' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={styles.inputLabel}>Charge cible ({weightUnit}) *</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Ex: 100"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            value={targetStrengthWeightInput}
            onChangeText={setTargetStrengthWeightInput}
          />

          <View style={styles.modalActions}>
            <Button
              title="Annuler"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Créer l’objectif"
              variant="primary"
              size="md"
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#172131',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#293A54',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  exerciseSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1622',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354F',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  exerciseSearchField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  noExerciseFoundText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 14,
  },
  exerciseChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0D1420',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  exerciseChoicePillActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
  },
  exerciseChoiceText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  exerciseChoiceMuscleSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  modalInput: {
    backgroundColor: '#0F1622',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354F',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
});
