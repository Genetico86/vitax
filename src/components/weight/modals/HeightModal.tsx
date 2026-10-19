import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';

interface HeightModalProps {
  visible: boolean;
  currentHeight?: number;
  onClose: () => void;
  onSave: (heightCm: number) => Promise<void>;
}

const HeightModalContent: React.FC<Omit<HeightModalProps, 'visible'>> = ({
  currentHeight,
  onClose,
  onSave,
}) => {
  const [heightInput, setHeightInput] = useState(
    currentHeight && currentHeight > 0 ? `${currentHeight}` : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseInt(heightInput.trim(), 10);
    if (isNaN(val) || val < 100 || val > 240) {
      Alert.alert(
        'Taille invalide',
        'Veuillez saisir une taille réaliste en centimètres (entre 100 et 240 cm, ex: 178).'
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(val);
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d’enregistrer votre taille.');
    } finally {
      setSaving(false);
    }
  };

  const QUICK_HEIGHTS = [165, 170, 175, 180, 185, 190];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalOverlay}
    >
        <View style={styles.modalCard}>
          <View style={styles.iconBox}>
            <Text style={{ fontSize: 24 }}>📏</Text>
          </View>

          <Text style={styles.modalTitle}>Renseigner votre taille</Text>
          <Text style={styles.modalSubtitle}>
            Indispensable pour calculer votre Indice de Masse Corporelle (IMC), votre métabolisme de base (BMR) et votre dépense énergétique (TDEE).
          </Text>

          {/* Saisie principale */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="178"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={3}
              value={heightInput}
              onChangeText={setHeightInput}
              autoFocus
            />
            <Text style={styles.unitText}>cm</Text>
          </View>

          {/* Suggestions rapides */}
          <Text style={styles.quickLabel}>Raccourcis rapides :</Text>
          <View style={styles.quickRow}>
            {QUICK_HEIGHTS.map((h) => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.quickChip,
                  heightInput === `${h}` && styles.quickChipActive,
                ]}
                onPress={() => setHeightInput(`${h}`)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickChipText,
                    heightInput === `${h}` && styles.quickChipTextActive,
                  ]}
                >
                  {h} cm
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Button
              title="Annuler"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8 }}
              disabled={saving}
            />
            <Button
              title={saving ? 'Enregistrement...' : 'Valider'}
              variant="primary"
              size="md"
              onPress={handleSave}
              style={{ flex: 1 }}
              loading={saving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
  );
};

export const HeightModal: React.FC<HeightModalProps> = ({
  visible,
  currentHeight,
  onClose,
  onSave,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <HeightModalContent
        currentHeight={currentHeight}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121A28',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E2B3E',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A101D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24334A',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 24,
    fontWeight: '800',
    color: '#38BDF8',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMuted,
    marginLeft: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1A2536',
    borderWidth: 1,
    borderColor: '#26374D',
  },
  quickChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  quickChipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
});
