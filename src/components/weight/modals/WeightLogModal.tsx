import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { BodyWeightLog } from '../../../types';

interface WeightLogModalProps {
  visible: boolean;
  editingLog: BodyWeightLog | null;
  weightUnit: string;
  defaultWeight?: number | null;
  onClose: () => void;
  onSave: (val: number, date: string, note?: string, bodyFat?: number) => Promise<void>;
}

const getTodayString = () => new Date().toISOString().slice(0, 10);
const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const WeightLogModalContent: React.FC<{
  editingLog: BodyWeightLog | null;
  weightUnit: string;
  defaultWeight?: number | null;
  onClose: () => void;
  onSave: (val: number, date: string, note?: string, bodyFat?: number) => Promise<void>;
}> = ({ editingLog, weightUnit, defaultWeight, onClose, onSave }) => {
  const today = getTodayString();
  const yesterday = getYesterdayString();

  const [weightInput, setWeightInput] = useState(
    editingLog ? `${editingLog.weight}` : defaultWeight ? `${defaultWeight}` : ''
  );
  const [dateInput, setDateInput] = useState(editingLog ? editingLog.date : today);
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>(() => {
    if (!editingLog) return 'today';
    if (editingLog.date === today) return 'today';
    if (editingLog.date === yesterday) return 'yesterday';
    return 'custom';
  });
  const [noteInput, setNoteInput] = useState(editingLog?.note || '');
  const [bodyFatInput, setBodyFatInput] = useState(
    editingLog?.body_fat_percentage ? `${editingLog.body_fat_percentage}` : ''
  );

  const handleSave = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(val) || val <= 20 || val >= 300) {
      Alert.alert('Poids invalide', 'Veuillez saisir un poids valide en kg (ex: 78.5).');
      return;
    }

    const trimmedDate = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert(
        'Date invalide',
        'Veuillez saisir une date au format AAAA-MM-JJ (ex: 2026-10-15).'
      );
      return;
    }

    const bodyFat = bodyFatInput ? parseFloat(bodyFatInput.replace(',', '.')) : undefined;

    await onSave(
      val,
      trimmedDate,
      noteInput.trim() || undefined,
      isNaN(bodyFat || NaN) ? undefined : bodyFat
    );
    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}
    >
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>
          {editingLog ? '✏️ Modifier la pesée' : '⚖️ Enregistrer votre poids'}
        </Text>
        <Text style={styles.modalSubtitle}>
          {editingLog
            ? 'Modifiez votre relevé pour cette date précise.'
            : 'Chaque date saisie est historisée pour tracer l’évolution de votre poids.'}
        </Text>

        {/* Sélecteur de date de pesée */}
        <Text style={styles.inputLabel}>Date de la pesée *</Text>
        <View style={styles.dateChipsRow}>
          <TouchableOpacity
            style={[styles.dateChip, dateMode === 'today' && styles.dateChipActive]}
            onPress={() => {
              setDateMode('today');
              setDateInput(getTodayString());
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateChipText, dateMode === 'today' && styles.dateChipTextActive]}>
              {"Aujourd'hui"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateChip, dateMode === 'yesterday' && styles.dateChipActive]}
            onPress={() => {
              setDateMode('yesterday');
              setDateInput(getYesterdayString());
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateChipText, dateMode === 'yesterday' && styles.dateChipTextActive]}>
              Hier
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateChip, dateMode === 'custom' && styles.dateChipActive]}
            onPress={() => setDateMode('custom')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateChipText, dateMode === 'custom' && styles.dateChipTextActive]}>
              Autre date
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.modalInput}
          placeholder="AAAA-MM-JJ (ex: 2026-10-15)"
          placeholderTextColor={Colors.textMuted}
          value={dateInput}
          onChangeText={(txt) => {
            setDateInput(txt);
            setDateMode('custom');
          }}
          maxLength={10}
        />
        <Text style={styles.dateHelperText}>
          📅 Format : AAAA-MM-JJ. Les pesées à dates distinctes sont toutes conservées.
        </Text>

        {/* Poids corporel */}
        <Text style={styles.inputLabel}>Poids corporel ({weightUnit}) *</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: 78.5"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={weightInput}
          onChangeText={setWeightInput}
          autoFocus={!editingLog}
        />

        {/* Taux de masse grasse */}
        <Text style={styles.inputLabel}>Masse grasse % (optionnel)</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: 14.5"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          value={bodyFatInput}
          onChangeText={setBodyFatInput}
        />

        {/* Note */}
        <Text style={styles.inputLabel}>Note (optionnel)</Text>
        <TextInput
          style={styles.modalInput}
          placeholder="Ex: À jeun au réveil, après entraînement..."
          placeholderTextColor={Colors.textMuted}
          value={noteInput}
          onChangeText={setNoteInput}
          maxLength={40}
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
            title={editingLog ? 'Mettre à jour' : 'Enregistrer'}
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

export const WeightLogModal: React.FC<WeightLogModalProps> = ({
  visible,
  editingLog,
  weightUnit,
  defaultWeight,
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
        <WeightLogModalContent
          editingLog={editingLog}
          weightUnit={weightUnit}
          defaultWeight={defaultWeight}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#151E2E',
    borderRadius: 16,
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
  dateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0D1420',
    borderWidth: 1,
    borderColor: '#25354F',
  },
  dateChipActive: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    borderColor: Colors.primary,
  },
  dateChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dateHelperText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
    marginBottom: 12,
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
