import React from 'react';
import { View, Text, Modal } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { FriendGift } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface CelebrateGiftModalProps {
  visible: boolean;
  celebratedGift: FriendGift | null;
  onClose: () => void;
}

export const CelebrateGiftModal: React.FC<CelebrateGiftModalProps> = ({
  visible,
  celebratedGift,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 24 }]}>
          <View style={styles.celebrateGiftIcon}>
            <Text style={{ fontSize: 50 }}>🎁🎉</Text>
          </View>
          <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 10 }]}>
            CADEAU RÉCLAMÉ !
          </Text>
          <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 4 }]}>
            Félicitations pour vos efforts ! Vous avez atteint les +{celebratedGift?.targetXpGain} XP requis.
          </Text>

          <View style={styles.celebrateGiftBox}>
            <Text style={styles.celebrateGiftName}>{celebratedGift?.giftName}</Text>
            <Text style={styles.celebrateGiftSender}>
              Offert avec fierté par {celebratedGift?.senderName}
            </Text>
            {celebratedGift?.personalMessage ? (
              <Text style={styles.celebrateGiftQuote}>
                « {celebratedGift.personalMessage} »
              </Text>
            ) : null}
          </View>

          <Text style={{ color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 14 }}>
            N’oubliez pas de contacter {celebratedGift?.senderName} pour récupérer votre dû ! 💪
          </Text>

          <Button
            title="C’est noté ! Merci 🚀"
            variant="primary"
            size="lg"
            onPress={onClose}
            style={{ width: '100%' }}
          />
        </View>
      </View>
    </Modal>
  );
};
