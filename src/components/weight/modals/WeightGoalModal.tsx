import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';

interface WeightGoalModalProps {
  visible: boolean;
  weightUnit: string;
  initialTarget?: number | null;
  initialStarting?: number | null;
  onClose: () => void;
  onSave: (target: number, starting?: number) => Promise<void>;
}

const WeightGoalModalContent: React.FC<{
  weightUnit: string;
  initialTarget?: number | null;
  initialStarting?: number | null;
  onClose: () => void;
  onSave: (target: number, starting?: number) => Promise<void>;
}> = ({ weightUnit, initialTarget, initialStarting, onClose, onSave }) => {
  const [targetWeightInput, setTargetWeightInput] = useState(
    initialTarget ? `${initialTarget}` : ''
  );
  const [startingWeightInput, setStartingWeightInput] = useState(
    initialStarting ? `${initialStarting}` : ''
  );

  const handleSave = async () => {
    const target = parseFloat(targetWeightInput.replace(',', '.'));
    if (isNaN(target) || target <= 25 || target >= 250) {
      Alert.alert('Objectif invalide', 'Veuillez entrer un poids cible réaliste.');
      return;
    }

    const starting = startingWeightInput
      ? parseFloat(startingWeightInput.replace(',', '.'))
      : undefined;

    await onSave(target, starting);
    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}
    >
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>🎯 Objectif de Poids Corporel</Text>
        <Text style={styles.modalSubtitle}>
          Fixez un poids cible vers lequel orienter vos efforts d’entraînement et de nutrition.
        </Text>

        <Text style={styles.inputLabel}>Poids cible ({weightUnit}) *</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: 75.0 pour une sèche, ou 82.0 pour une prise"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={targetWeightInput}
          onChangeText={setTargetWeightInput}
          autoFocus
        />

        <Text style={styles.inputLabel}>Poids de départ ({weightUnit})</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: 80.0"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={startingWeightInput}
          onChangeText={setStartingWeightInput}
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
            title="Enregistrer"
            variant="primary"
            size="md"
            onPress={handleSave}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export const WeightGoalModal: React.FC<WeightGoalModalProps> = ({
  visible,
  weightUnit,
  initialTarget,
  initialStarting,
  onClose,
  onSave,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {visible ? (
        <WeightGoalModalContent
          weightUnit={weightUnit}
          initialTarget={initialTarget}
          initialStarting={initialStarting}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
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
