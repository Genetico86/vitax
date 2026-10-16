import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { arenaStyles as styles } from '../styles/arenaStyles';
import { showAlert } from '../../../utils/alert';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onAddFriend: (code: string) => Promise<boolean>;
  onSimulateInvite: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  visible,
  onClose,
  onAddFriend,
  onSimulateInvite,
}) => {
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!friendCodeInput.trim()) {
      showAlert('Code requis', 'Veuillez saisir le Code Ami à 5 chiffres (ex: 48219) ou le pseudo.');
      return;
    }
    setLoading(true);
    const success = await onAddFriend(friendCodeInput.trim());
    setLoading(false);
    if (success) {
      setFriendCodeInput('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Ajouter un Ami 👥</Text>
          <Text style={styles.modalSub}>
            Saisissez le Code Ami à 5 chiffres (ex: 48219) ou le Pseudo de votre partenaire :
          </Text>

          <TextInput
            style={styles.modalTextInput}
            placeholder="Code à 5 chiffres (ex: 48219) ou Pseudo"
            placeholderTextColor={Colors.textMuted}
            value={friendCodeInput}
            onChangeText={setFriendCodeInput}
            autoCapitalize="none"
            maxLength={40}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button
              title="Annuler"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={loading ? 'Vérification...' : 'Ajouter l’ami'}
              variant="primary"
              size="md"
              onPress={handleAdd}
              disabled={loading}
              style={{ flex: 1 }}
            />
          </View>

          {__DEV__ && (
            <TouchableOpacity
              style={styles.simulateInviteBtn}
              onPress={() => {
                onClose();
                onSimulateInvite();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.simulateInviteBtnText}>
                🔔 Simuler une invitation reçue (Test notification)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};
