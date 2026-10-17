import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface TrainerAuthModalProps {
  visible: boolean;
  initialMode?: 'register' | 'login';
  initialUsername?: string;
  onClose: () => void;
  onSubmit: (mode: 'register' | 'login', u: string, p: string) => Promise<boolean>;
}

const TrainerAuthModalContent: React.FC<{
  initialMode: 'register' | 'login';
  initialUsername: string;
  onClose: () => void;
  onSubmit: (mode: 'register' | 'login', u: string, p: string) => Promise<boolean>;
}> = ({ initialMode, initialUsername, onClose, onSubmit }) => {
  const [authMode, setAuthMode] = useState<'register' | 'login'>(initialMode);
  const [authUsername, setAuthUsername] = useState(initialUsername);
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async () => {
    if (!authUsername.trim() || !authPassword) {
      Alert.alert('Champs requis', 'Veuillez saisir votre nom d’utilisateur et votre mot de passe.');
      return;
    }
    setAuthLoading(true);
    const success = await onSubmit(authMode, authUsername.trim(), authPassword);
    setAuthLoading(false);
    if (success) {
      setAuthPassword('');
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={styles.authModalIcon}>
            <Text style={{ fontSize: 32 }}>🏆</Text>
          </View>
          <Text style={styles.modalTitle}>
            {authMode === 'register' ? 'Créer mon Compte Athlète' : 'Connexion Compte Athlète'}
          </Text>
          <Text style={styles.modalSub}>
            {authMode === 'register'
              ? 'Rejoignez le classement partagé et sauvegardez vos séances et statistiques sur le cloud.'
              : 'Retrouvez votre compte, vos séances et vos statistiques sur cet appareil.'}
          </Text>
        </View>

        <View style={{ marginBottom: 10 }}>
          <Text style={styles.inputLabel}>Nom d’utilisateur (Pseudo)</Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="Ex: Alexandre, Sarah, Thomas..."
            placeholderTextColor={Colors.textMuted}
            value={authUsername}
            onChangeText={setAuthUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={styles.inputLabel}>Mot de passe</Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={authPassword}
            onChangeText={setAuthPassword}
          />
        </View>

        <View style={styles.authPersistentHint}>
          <Text style={styles.authPersistentHintText}>
            🔒 Connexion permanente : vous n’aurez jamais besoin de resaisir votre mot de passe à l’ouverture de l’application.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button
            title="Fermer"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title={
              authLoading
                ? 'Chargement...'
                : authMode === 'register'
                ? 'Créer le compte 🚀'
                : 'Se connecter ⚡'
            }
            variant="primary"
            size="md"
            onPress={handleSubmit}
            disabled={authLoading}
            style={{ flex: 1.3 }}
          />
        </View>

        <TouchableOpacity
          style={styles.authToggleModeBtn}
          onPress={() => setAuthMode((m) => (m === 'register' ? 'login' : 'register'))}
        >
          <Text style={styles.authToggleModeText}>
            {authMode === 'register'
              ? 'Vous avez déjà un compte ? Connectez-vous'
              : 'Nouvel athlète ? Créez un compte'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const TrainerAuthModal: React.FC<TrainerAuthModalProps> = ({
  visible,
  initialMode = 'register',
  initialUsername = '',
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {visible ? (
        <TrainerAuthModalContent
          initialMode={initialMode}
          initialUsername={initialUsername}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
