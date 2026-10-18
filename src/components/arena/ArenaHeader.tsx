import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TrainerProfile } from '../../types/social';
import { arenaStyles as styles } from './styles/arenaStyles';
import { ArenaTab } from './hooks/useArenaData';

import { UserAvatar } from '../common/UserAvatar';

interface ArenaHeaderProps {
  profile: TrainerProfile | null;
  leagueName?: string;
  isLoggedIn: boolean;
  activeTab: ArenaTab;
  onTabChange: (tab: ArenaTab) => void;
  onShareFriendCode: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const ArenaHeader: React.FC<ArenaHeaderProps> = ({
  profile,
  leagueName,
  isLoggedIn,
  activeTab,
  onTabChange,
  onShareFriendCode,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <View>
      {/* En-tête Dresseur Profil & Code Ami */}
      {profile && (
        <View style={styles.profileHeader}>
          <View style={[styles.profileAvatarBox, { padding: 0, overflow: 'hidden' }]}>
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              fallbackEmoji={profile.avatarPokemonEmoji || '⚡'}
              size={48}
              style={{ borderWidth: 0 }}
              userName={profile.username}
              userSubtitle={`${profile.trainerTitle} • ${leagueName || 'Ligue Musculation'}`}
              onPress={onOpenAuth}
              onEditPress={onOpenAuth}
              enableEnlarge
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.profileNameRow}>
              <TouchableOpacity onPress={onOpenAuth} activeOpacity={0.7}>
                <Text style={styles.profileUsername}>{profile.username}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.friendCodeBadge}
                onPress={onShareFriendCode}
                activeOpacity={0.7}
              >
                <Text style={styles.friendCodeText}>{profile.friendCode} 📤</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.profileTitleText}>
              {profile.trainerTitle} • {leagueName || 'Ligue Musculation'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.accountStatusBtn}
            onPress={() => {
              if (isLoggedIn) {
                onLogout();
              } else {
                onOpenAuth();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.accountStatusBtnText}>
              {isLoggedIn ? '🟢 Compte actif' : '⚡ Connexion / Compte'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sélecteur d'onglets de l'Arène */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leaderboard' && styles.tabButtonActive]}
          onPress={() => onTabChange('leaderboard')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'leaderboard' && styles.tabButtonTextActive]}>
            🏆 Ligues & XP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'raids' && styles.tabButtonActive]}
          onPress={() => onTabChange('raids')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'raids' && styles.tabButtonTextActive]}>
            ⚔️ Défis & Raids
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
