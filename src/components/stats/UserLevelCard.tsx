import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LevelInfo } from '../../services/gamificationService';
import { Colors } from '../../constants/colors';

interface UserLevelCardProps {
  levelInfo: LevelInfo;
  onPress?: () => void;
}

export const UserLevelCard: React.FC<UserLevelCardProps> = ({
  levelInfo,
  onPress,
}) => {
  const remainingXp = Math.max(0, levelInfo.nextLevelXp - levelInfo.currentXp);
  const isMaxLevel = levelInfo.level >= 9;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.badgeBox}>
          <Text style={styles.badgeEmoji}>{levelInfo.badgeEmoji}</Text>
        </View>

        <View style={styles.levelInfo}>
          <View style={styles.levelRow}>
            <View style={styles.tagWrapper}>
              <Text style={styles.pokeballIcon}>🔴</Text>
              <Text style={styles.levelTag}>BADGE POKÉMON • NIV. {levelInfo.level}</Text>
            </View>
            <Text style={styles.xpText}>{levelInfo.currentXp} XP</Text>
          </View>
          <Text style={styles.titleText}>{levelInfo.title}</Text>
          {levelInfo.city ? (
            <Text style={styles.arenaSub}>
              Arène d’{levelInfo.city} ({levelInfo.champion}) • {levelInfo.type}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Barre de progression XP vers le prochain badge */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(100, Math.max(0, levelInfo.progressPercent))}%` },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressSub}>
            {levelInfo.progressPercent}% du palier
          </Text>
          <Text style={styles.progressRemaining}>
            {isMaxLevel
              ? '👑 Titre Suprême Obtenu !'
              : `Encore ${remainingXp} XP ➔ ${levelInfo.nextBadgeTitle} ${levelInfo.nextBadgeEmoji}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121B2A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#24344D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1A273A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#334863',
  },
  badgeEmoji: {
    fontSize: 28,
  },
  levelInfo: {
    flex: 1,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pokeballIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  levelTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  arenaSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1C2738',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressSub: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  progressRemaining: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '700',
  },
});
