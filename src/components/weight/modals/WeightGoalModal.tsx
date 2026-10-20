import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { WeightGoalType } from '../../../utils/physiologyUtils';

interface WeightGoalModalProps {
  visible: boolean;
  weightUnit: string;
  initialTarget?: number | null;
  initialStarting?: number | null;
  initialGoalType?: WeightGoalType;
  onClose: () => void;
  onSave: (target: number, starting?: number, goalType?: WeightGoalType) => Promise<void>;
}

const WeightGoalModalContent: React.FC<{
  weightUnit: string;
  initialTarget?: number | null;
  initialStarting?: number | null;
  initialGoalType?: WeightGoalType;
  onClose: () => void;
  onSave: (target: number, starting?: number, goalType?: WeightGoalType) => Promise<void>;
}> = ({ weightUnit, initialTarget, initialStarting, initialGoalType = 'loss', onClose, onSave }) => {
  const [goalType, setGoalType] = useState<WeightGoalType>(() => {
    if (initialGoalType) return initialGoalType;
    if (initialStarting && initialTarget) {
      if (initialStarting > initialTarget) return 'loss';
      if (initialStarting < initialTarget) return 'bulk';
      return 'maintain';
    }
    return 'loss';
  });

  const [targetWeightInput, setTargetWeightInput] = useState(
    initialTarget ? `${initialTarget}` : ''
  );
  const [startingWeightInput, setStartingWeightInput] = useState(
    initialStarting ? `${initialStarting}` : ''
  );

  const handleSelectGoalType = (type: WeightGoalType) => {
    setGoalType(type);
    if (type === 'maintain' && startingWeightInput && !targetWeightInput) {
      setTargetWeightInput(startingWeightInput);
    }
  };

  const handleSave = async () => {
    const target = parseFloat(targetWeightInput.replace(',', '.'));
    if (isNaN(target) || target <= 25 || target >= 250) {
      Alert.alert('Objectif invalide', 'Veuillez entrer un poids cible réaliste (25 à 250 kg).');
      return;
    }

    const starting = startingWeightInput
      ? parseFloat(startingWeightInput.replace(',', '.'))
      : undefined;

    // Cohérence biomécanique
    if (starting) {
      if (goalType === 'loss' && target >= starting) {
        Alert.alert(
          'Incohérence d’objectif',
          'En mode Sèche / Perte, le poids cible doit être inférieur à votre poids de départ.'
        );
        return;
      }
      if (goalType === 'bulk' && target <= starting) {
        Alert.alert(
          'Incohérence d’objectif',
          'En mode Prise de masse, le poids cible doit être supérieur à votre poids de départ.'
        );
        return;
      }
    }

    await onSave(target, starting, goalType);
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
          Fixez un objectif cohérent avec votre stratégie d’entraînement et de nutrition.
        </Text>

        {/* Sélecteur de type d'objectif */}
        <Text style={styles.inputLabel}>Type d’objectif *</Text>
        <View style={styles.goalTypeTabsRow}>
          <TouchableOpacity
            style={[
              styles.goalTypeTab,
              goalType === 'loss' && styles.goalTypeTabActive,
            ]}
            onPress={() => handleSelectGoalType('loss')}
            activeOpacity={0.8}
          >
            <Text style={styles.goalTypeIcon}>📉</Text>
            <Text
              style={[
                styles.goalTypeTabText,
                goalType === 'loss' && styles.goalTypeTabTextActive,
              ]}
              numberOfLines={1}
            >
              Sèche / Perte
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.goalTypeTab,
              goalType === 'maintain' && styles.goalTypeTabActive,
            ]}
            onPress={() => handleSelectGoalType('maintain')}
            activeOpacity={0.8}
          >
            <Text style={styles.goalTypeIcon}>⚖️</Text>
            <Text
              style={[
                styles.goalTypeTabText,
                goalType === 'maintain' && styles.goalTypeTabTextActive,
              ]}
              numberOfLines={1}
            >
              Maintien
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.goalTypeTab,
              goalType === 'bulk' && styles.goalTypeTabActive,
            ]}
            onPress={() => handleSelectGoalType('bulk')}
            activeOpacity={0.8}
          >
            <Text style={styles.goalTypeIcon}>📈</Text>
            <Text
              style={[
                styles.goalTypeTabText,
                goalType === 'bulk' && styles.goalTypeTabTextActive,
              ]}
              numberOfLines={1}
            >
              Prise de masse
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conseil scientifique d'accompagnement */}
        <View style={styles.scientificTipCard}>
          <Text style={styles.scientificTipText}>
            {goalType === 'bulk'
              ? '💡 Prise de masse : Visez un surplus progressif (+250-350 kcal) et une prise lente (0,2 à 0,4 kg / semaine) pour minimiser la prise de graisse.'
              : goalType === 'maintain'
              ? '💡 Maintien / Recomposition : Stabilisez votre poids tout en cherchant à surcharger progressivement vos barres en musculation.'
              : '💡 Sèche progressive : Visez un déficit modéré (-300-400 kcal) et un apport en protéines élevé pour préserver votre capital musculaire.'}
          </Text>
        </View>

        <Text style={styles.inputLabel}>Poids cible ({weightUnit}) *</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: 75.0"
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
  initialGoalType,
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
          initialGoalType={initialGoalType}
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
    maxWidth: 400,
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
    marginBottom: 14,
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalTypeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  goalTypeTab: {
    flex: 1,
    backgroundColor: '#0F1622',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#25354F',
  },
  goalTypeTabActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  goalTypeIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  goalTypeTabText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  goalTypeTabTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  scientificTipCard: {
    backgroundColor: '#0B1320',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1D2A3E',
    marginBottom: 14,
  },
  scientificTipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
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
