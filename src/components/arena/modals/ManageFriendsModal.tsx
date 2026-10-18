import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../../common/Button';
import { UserAvatar } from '../../common/UserAvatar';
import { FriendEntry } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface ManageFriendsModalProps {
  visible: boolean;
  friendsList: FriendEntry[];
  friendCode?: string;
  onClose: () => void;
  onOpenAddFriend: () => void;
  onOpenCreateGift: (targetFriendCode: string) => void;
  onRemoveFriend: (friendId: string, friendName: string) => void;
}

export const ManageFriendsModal: React.FC<ManageFriendsModalProps> = ({
  visible,
  friendsList,
  friendCode,
  onClose,
  onOpenAddFriend,
  onOpenCreateGift,
  onRemoveFriend,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={styles.modalTitle}>Mes Amis ({friendsList.length})</Text>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onOpenAddFriend();
              }}
              style={styles.addFriendMiniBtn}
            >
              <Text style={styles.addFriendMiniBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            Cercle restreint d’athlètes partenaires de votre club :
          </Text>

          <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
            {friendsList.length === 0 ? (
              <Text style={styles.emptyNote}>
                Aucun ami dans votre cercle. Partagez votre Code Ami ({friendCode}) pour commencer !
              </Text>
            ) : (
              friendsList.map((f) => (
                <View key={f.friendId} style={styles.friendManageRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <UserAvatar
                      avatarUrl={f.avatarUrl}
                      fallbackEmoji={f.avatarPokemonEmoji || '⚡'}
                      size={36}
                      style={{ borderWidth: 0 }}
                      userName={f.username}
                      userSubtitle={`Code Ami : ${f.friendCode} • ${f.trainerTitle}`}
                      enableEnlarge
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendManageName}>{f.username}</Text>
                      <Text style={styles.friendManageCode}>{f.friendCode} • {f.trainerTitle}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.friendGiftMiniBtn}
                      onPress={() => {
                        onClose();
                        onOpenCreateGift(f.friendCode);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.friendGiftMiniBtnText}>🎁 Offrir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.friendDeleteBtn}
                      onPress={() => onRemoveFriend(f.friendId, f.username)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.friendDeleteBtnText}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Button
            title="Fermer"
            variant="outline"
            size="md"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
};
