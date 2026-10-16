import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { FriendEntry } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface CreateGiftModalProps {
  visible: boolean;
  friendsList: FriendEntry[];
  initialTargetFriendCode?: string;
  onClose: () => void;
  onSubmit: (
    targetFriendCode: string,
    giftName: string,
    targetXp: number,
    personalMessage?: string
  ) => Promise<boolean>;
}

const CreateGiftModalContent: React.FC<{
  friendsList: FriendEntry[];
  initialTargetFriendCode?: string;
  onClose: () => void;
  onSubmit: (
    targetFriendCode: string,
    giftName: string,
    targetXp: number,
    personalMessage?: string
  ) => Promise<boolean>;
}> = ({ friendsList, initialTargetFriendCode, onClose, onSubmit }) => {
  const [giftTargetFriendCode, setGiftTargetFriendCode] = useState(
    initialTargetFriendCode || friendsList[0]?.friendCode || ''
  );
  const [giftNameInput, setGiftNameInput] = useState('');
  const [giftTargetXpInput, setGiftTargetXpInput] = useState('300');
  const [giftPersonalMessageInput, setGiftPersonalMessageInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!giftNameInput.trim()) {
      Alert.alert('Nom du cadeau requis', 'Veuillez saisir ce que vous souhaitez offrir (ex: Shaker de Whey, Resto post-séance, Barres...).');
      return;
    }
    const targetXp = parseInt(giftTargetXpInput, 10);
    if (isNaN(targetXp) || targetXp < 50) {
      Alert.alert('Objectif d’XP invalide', 'Veuillez définir au moins 50 XP pour débloquer ce cadeau.');
      return;
    }
    if (!giftTargetFriendCode) {
      Alert.alert('Ami introuvable', 'Veuillez sélectionner un ami dans votre cercle.');
      return;
    }

    setLoading(true);
    const success = await onSubmit(
      giftTargetFriendCode,
      giftNameInput.trim(),
      targetXp,
      giftPersonalMessageInput.trim() || undefined
    );
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { maxHeight: '90%' }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={styles.giftModalIconBox}>
              <Text style={{ fontSize: 32 }}>🎁</Text>
            </View>
            <Text style={styles.modalTitle}>Offrir un Cadeau de Motivation</Text>
            <Text style={styles.modalSub}>
              Promettez un cadeau concret à un ami. Il se débloquera dès qu’il aura gagné le quota d’XP requis !
            </Text>
          </View>

          {/* Sélection de l'ami */}
          <Text style={styles.inputLabel}>Choisir le destinataire *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {friendsList.map((f) => {
              const isSel = (giftTargetFriendCode || friendsList[0]?.friendCode) === f.friendCode;
              return (
                <TouchableOpacity
                  key={f.friendId}
                  style={[
                    styles.chipSelectItem,
                    isSel && styles.chipSelectItemActive,
                  ]}
                  onPress={() => setGiftTargetFriendCode(f.friendCode)}
                >
                  <Text
                    style={[
                      styles.chipSelectText,
                      isSel && styles.chipSelectTextActive,
                    ]}
                  >
                    {f.avatarPokemonEmoji} {f.username}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Nom du cadeau */}
          <Text style={styles.inputLabel}>Nom du cadeau promis *</Text>
          <TextInput
            style={styles.modalTextInput}
            placeholder="Ex: Shaker de Whey, Resto post-séance, Barres..."
            placeholderTextColor={Colors.textMuted}
            value={giftNameInput}
            onChangeText={setGiftNameInput}
            maxLength={60}
          />

          {/* Suggestions rapides de cadeaux */}
          <View style={styles.quickGiftSuggestionsRow}>
            {['Shaker de Whey', 'Resto post-séance', 'Barres Protéinées', 'Place de Ciné'].map((sug) => (
              <TouchableOpacity
                key={sug}
                style={styles.quickGiftChip}
                onPress={() => setGiftNameInput(sug)}
              >
                <Text style={styles.quickGiftChipText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quota d'XP requis */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            XP à obtenir pour débloquer le cadeau *
          </Text>
          <View style={styles.xpPresetRow}>
            {['150', '300', '500', '1000'].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.xpPresetBtn,
                  giftTargetXpInput === val && styles.xpPresetBtnActive,
                ]}
                onPress={() => setGiftTargetXpInput(val)}
              >
                <Text
                  style={[
                    styles.xpPresetBtnText,
                    giftTargetXpInput === val && styles.xpPresetBtnTextActive,
                  ]}
                >
                  +{val} XP
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.modalTextInput, { marginTop: 8 }]}
            placeholder="Ou montant personnalisé (ex: 750)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            value={giftTargetXpInput}
            onChangeText={setGiftTargetXpInput}
          />

          {/* Message personnel */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Mot d’encouragement (optionnel)
          </Text>
          <TextInput
            style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Ex: Donne tout sur tes prochaines séances, ce cadeau est pour toi !"
            placeholderTextColor={Colors.textMuted}
            multiline
            value={giftPersonalMessageInput}
            onChangeText={setGiftPersonalMessageInput}
            maxLength={140}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button
              title="Annuler"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={loading ? 'Envoi...' : 'Envoyer le Cadeau 🎁'}
              variant="primary"
              size="md"
              onPress={handleSubmit}
              disabled={loading}
              style={{ flex: 1.5 }}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export const CreateGiftModal: React.FC<CreateGiftModalProps> = ({
  visible,
  friendsList,
  initialTargetFriendCode,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible ? (
        <CreateGiftModalContent
          friendsList={friendsList}
          initialTargetFriendCode={initialTargetFriendCode}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
