import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { UserAvatar } from './UserAvatar';

interface AvatarPickerModalProps {
  visible: boolean;
  currentAvatarUrl?: string | null;
  onClose: () => void;
  onAvatarSelected: (avatarUrl: string | undefined) => Promise<void> | void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  visible,
  currentAvatarUrl,
  onClose,
  onAvatarSelected,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePickFromGallery = async () => {
    try {
      setLoading(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setLoading(false);
        showAlert(
          'Accès Galerie Refusé 📷',
          'Veuillez autoriser l’accès à vos photos dans les paramètres de votre appareil pour choisir une photo de profil.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        await onAvatarSelected(dataUrl);
        onClose();
      }
    } catch (err: any) {
      console.warn('Erreur choix image galerie:', err);
      showAlert('Erreur', 'Impossible de charger l’image sélectionnée.');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeSelfie = async () => {
    try {
      setLoading(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setLoading(false);
        showAlert(
          'Accès Caméra Refusé 🤳',
          'Veuillez autoriser l’accès à l’appareil photo dans les paramètres de votre appareil pour prendre un selfie.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        await onAvatarSelected(dataUrl);
        onClose();
      }
    } catch (err: any) {
      console.warn('Erreur prise selfie caméra:', err);
      showAlert('Erreur', 'Impossible d’utiliser l’appareil photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAvatar = () => {
    showAlert(
      'Supprimer la photo',
      'Voulez-vous rétablir l’avatar par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await onAvatarSelected(undefined);
              onClose();
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.avatarPreviewWrapper}>
              <UserAvatar
                avatarUrl={currentAvatarUrl}
                size={84}
                fallbackEmoji="👤"
              />
            </View>
            <Text style={styles.title}>Photo de profil</Text>
            <Text style={styles.subtitle}>
              Prenez un selfie ou choisissez une image de votre galerie pour personnaliser votre profil athlète.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Traitement de l’image...</Text>
            </View>
          ) : (
            <View style={styles.actionsContainer}>
              {/* Option Selfie (Caméra Avant) */}
              <TouchableOpacity
                style={styles.actionButtonPrimary}
                onPress={handleTakeSelfie}
                activeOpacity={0.8}
              >
                <View style={styles.actionIconCircle}>
                  <Text style={styles.actionIcon}>🤳</Text>
                </View>
                <View style={styles.actionTextBox}>
                  <Text style={styles.actionTitle}>Prendre un selfie</Text>
                  <Text style={styles.actionSubtitle}>Mode caméra frontale instantané</Text>
                </View>
                <Text style={styles.actionArrow}>❯</Text>
              </TouchableOpacity>

              {/* Option Galerie Photos */}
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: '#1E293B' }]}>
                  <Text style={styles.actionIcon}>🖼️</Text>
                </View>
                <View style={styles.actionTextBox}>
                  <Text style={styles.actionTitle}>Choisir dans la galerie</Text>
                  <Text style={styles.actionSubtitle}>Importer une photo depuis vos albums</Text>
                </View>
                <Text style={styles.actionArrow}>❯</Text>
              </TouchableOpacity>

              {/* Option Supprimer si photo déjà existante */}
              {Boolean(currentAvatarUrl) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleRemoveAvatar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Supprimer la photo actuelle</Text>
                </TouchableOpacity>
              )}

              {/* Bouton Annuler */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPreviewWrapper: {
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 10,
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginTop: 2,
  },
  actionArrow: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginTop: 2,
  },
  deleteButtonText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#1E293B',
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
});
