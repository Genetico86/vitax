import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { UserAvatar } from '../../common/UserAvatar';
import { LeaderboardEntry, AthleteShowcase } from '../../../types/social';
import { getAthleteShowcase } from '../../../services/multiplayer/athleteProfileService';
import { LEAGUE_CONFIGS } from '../../../services/multiplayer/profileService';
import { showAlert } from '../../../utils/alert';

interface AthleteProfileModalProps {
  visible: boolean;
  athlete: LeaderboardEntry | null;
  onClose: () => void;
  onInviteAthlete?: (entry: LeaderboardEntry) => void;
  isAlreadyFriend?: boolean;
}

type ProfileTab = 'exercises' | 'records' | 'history';

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  visible,
  athlete,
  onClose,
  onInviteAthlete,
  isAlreadyFriend = false,
}) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('exercises');
  const [showcase, setShowcase] = useState<AthleteShowcase | null>(null);

  useEffect(() => {
    if (!visible || !athlete) return;
    let isMounted = true;
    getAthleteShowcase(athlete, athlete.isCurrentUser)
      .then((data) => {
        if (isMounted) {
          setShowcase(data);
        }
      })
      .catch((err) => {
        console.warn('Erreur chargement profil athlète:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [visible, athlete]);

  const handleClose = () => {
    setActiveTab('exercises');
    setShowcase(null);
    onClose();
  };

  if (!visible || !athlete) return null;

  const isDataLoaded = showcase !== null && showcase.userId === athlete.userId;

  const currentLeagueConfig =
    LEAGUE_CONFIGS[showcase?.currentLeague || athlete?.currentLeague || 'pierre'] ||
    LEAGUE_CONFIGS.pierre;

  const handleCopyCode = async () => {
    const code = showcase?.friendCode || athlete?.friendCode;
    if (!code) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        showAlert('Code copié ! 📋', `Le Code Ami (${code}) a été copié dans le presse-papier.`);
        return;
      }
      showAlert('Code Ami 📋', `Code Ami de l'athlète : ${code}`);
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={localStyles.overlay}>
        <View style={localStyles.modalContainer}>
          {/* BOUTON FERMER */}
          <TouchableOpacity
            style={localStyles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Fermer le profil athlète"
          >
            <Text style={localStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {!isDataLoaded || !showcase ? (
            <View style={localStyles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={localStyles.loadingText}>
                Chargement des records & historique...
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={localStyles.scrollBody}
            >
              {/* EN-TÊTE PROFIL ATHLÈTE */}
              <View style={localStyles.profileHeader}>
                <View style={localStyles.avatarWrapper}>
                  <UserAvatar
                    avatarUrl={showcase.avatarUrl}
                    fallbackEmoji={showcase.avatarPokemonEmoji || '⚡'}
                    size={68}
                    userName={showcase.username}
                    enableEnlarge
                  />
                </View>

                <View style={localStyles.titleSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={localStyles.usernameText} numberOfLines={1}>
                      {showcase.username}
                    </Text>
                    {showcase.isCurrentUser && (
                      <View style={localStyles.youBadge}>
                        <Text style={localStyles.youBadgeText}>VOUS</Text>
                      </View>
                    )}
                  </View>

                  <Text style={localStyles.trainerTitleText} numberOfLines={1}>
                    {showcase.trainerTitle}
                  </Text>

                  {showcase.friendCode && (
                    <TouchableOpacity
                      onPress={handleCopyCode}
                      style={localStyles.friendCodeRow}
                      activeOpacity={0.7}
                    >
                      <Text style={localStyles.friendCodeLabel}>Code Ami :</Text>
                      <Text style={localStyles.friendCodeValue}>{showcase.friendCode}</Text>
                      <Text style={localStyles.friendCodeCopyIcon}>📋</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* BADGES RANG & LIGUE */}
              <View style={localStyles.badgesRow}>
                {/* Badge Ligue */}
                <View
                  style={[
                    localStyles.badgePill,
                    {
                      borderColor: `${currentLeagueConfig.color}40`,
                      backgroundColor: `${currentLeagueConfig.color}15`,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13 }}>{currentLeagueConfig.emoji}</Text>
                  <Text
                    style={[
                      localStyles.badgePillText,
                      { color: currentLeagueConfig.color },
                    ]}
                  >
                    {currentLeagueConfig.name}
                  </Text>
                </View>

                {/* Badge Rang d'Athlète */}
                <View
                  style={[
                    localStyles.badgePill,
                    {
                      borderColor: 'rgba(255, 45, 85, 0.35)',
                      backgroundColor: 'rgba(255, 45, 85, 0.12)',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 13 }}>{showcase.athleteRank.emoji}</Text>
                  <Text
                    style={[
                      localStyles.badgePillText,
                      { color: Colors.primary },
                    ]}
                  >
                    Niv. {showcase.athleteRank.level} • {showcase.athleteRank.badgeName}
                  </Text>
                </View>
              </View>

              {/* GRILLE 4 STATS ATHLÈTE */}
              <View style={localStyles.statsGrid}>
                <View style={localStyles.statBox}>
                  <Text style={localStyles.statValue}>
                    {showcase.totalXp.toLocaleString()}
                  </Text>
                  <Text style={localStyles.statLabel}>XP TOTALE</Text>
                </View>
                <View style={localStyles.statBox}>
                  <Text style={[localStyles.statValue, { color: Colors.success }]}>
                    +{showcase.weeklyXp.toLocaleString()}
                  </Text>
                  <Text style={localStyles.statLabel}>XP CETTE SEMAINE</Text>
                </View>
                <View style={localStyles.statBox}>
                  <Text style={localStyles.statValue}>
                    {showcase.workoutsCount}
                  </Text>
                  <Text style={localStyles.statLabel}>SÉANCES TOTALES</Text>
                </View>
                <View style={localStyles.statBox}>
                  <Text style={[localStyles.statValue, { color: Colors.accent }]}>
                    {showcase.totalTonnageKg.toLocaleString()} kg
                  </Text>
                  <Text style={localStyles.statLabel}>TONNAGE CUMULÉ</Text>
                </View>
              </View>

              {/* CONTRÔLE SEGMENTÉ : 3 ONGLETS */}
              <View style={localStyles.segmentTabs}>
                <TouchableOpacity
                  style={[
                    localStyles.segmentBtn,
                    activeTab === 'exercises' && localStyles.segmentBtnActive,
                  ]}
                  onPress={() => setActiveTab('exercises')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      localStyles.segmentBtnText,
                      activeTab === 'exercises' && localStyles.segmentBtnTextActive,
                    ]}
                  >
                    ⭐️ Préférés ({showcase.topExercises.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    localStyles.segmentBtn,
                    activeTab === 'records' && localStyles.segmentBtnActive,
                  ]}
                  onPress={() => setActiveTab('records')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      localStyles.segmentBtnText,
                      activeTab === 'records' && localStyles.segmentBtnTextActive,
                    ]}
                  >
                    🏆 Records ({showcase.personalRecords.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    localStyles.segmentBtn,
                    activeTab === 'history' && localStyles.segmentBtnActive,
                  ]}
                  onPress={() => setActiveTab('history')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      localStyles.segmentBtnText,
                      activeTab === 'history' && localStyles.segmentBtnTextActive,
                    ]}
                  >
                    📅 Séances ({showcase.recentWorkouts.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ONGLET 1 : EXERCICES PRÉFÉRÉS (LES PLUS PRATIQUÉS) */}
              {activeTab === 'exercises' && (
                <View style={localStyles.tabContent}>
                  <Text style={localStyles.sectionTitle}>
                    Mouvements les plus pratiqués à l’entraînement
                  </Text>
                  {showcase.topExercises.length === 0 ? (
                    <Text style={localStyles.emptyText}>
                      Aucun exercice enregistré pour le moment.
                    </Text>
                  ) : (
                    showcase.topExercises.map((ex, idx) => (
                      <View key={ex.id || idx} style={localStyles.itemCard}>
                        <View style={localStyles.itemRankBox}>
                          <Text style={localStyles.itemRankText}>#{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={localStyles.itemTitle}>{ex.name}</Text>
                          <Text style={localStyles.itemSubtitle}>
                            {ex.targetMuscle} • {ex.totalSets} série{ex.totalSets > 1 ? 's' : ''} validée{ex.totalSets > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={localStyles.itemMetricHighlight}>
                            {ex.maxWeightKg > 0 ? `Max ${ex.maxWeightKg} kg` : `${ex.totalSets} sets`}
                          </Text>
                          <Text style={localStyles.itemMetricSub}>
                            Vol: {ex.totalVolumeKg.toLocaleString()} kg
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* ONGLET 2 : RECORDS PERSONNELS (PRs) */}
              {activeTab === 'records' && (
                <View style={localStyles.tabContent}>
                  <Text style={localStyles.sectionTitle}>
                    Meilleures performances maximales enregistrées
                  </Text>
                  {showcase.personalRecords.length === 0 ? (
                    <Text style={localStyles.emptyText}>
                      Aucun record validé pour le moment.
                    </Text>
                  ) : (
                    showcase.personalRecords.map((pr, idx) => (
                      <View key={pr.id || idx} style={localStyles.itemCard}>
                        <View
                          style={[
                            localStyles.itemRankBox,
                            { backgroundColor: 'rgba(255, 214, 10, 0.15)', borderColor: 'rgba(255, 214, 10, 0.3)' },
                          ]}
                        >
                          <Text style={{ fontSize: 16 }}>🥇</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={localStyles.itemTitle}>{pr.exerciseName}</Text>
                          <Text style={localStyles.itemSubtitle}>
                            {pr.targetMuscle} {pr.achievedAt ? `• ${pr.achievedAt}` : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[localStyles.itemMetricHighlight, { color: Colors.warning }]}>
                            {pr.bestWeightKg} kg × {pr.reps}
                          </Text>
                          <Text style={localStyles.itemMetricSub}>
                            1RM ~{pr.estimatedOneRepMaxKg} kg
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* ONGLET 3 : HISTORIQUE D'ENTRAÎNEMENT */}
              {activeTab === 'history' && (
                <View style={localStyles.tabContent}>
                  <Text style={localStyles.sectionTitle}>
                    Dernières séances complétées par cet athlète
                  </Text>
                  {showcase.recentWorkouts.length === 0 ? (
                    <Text style={localStyles.emptyText}>
                      Aucune séance récente enregistrée.
                    </Text>
                  ) : (
                    showcase.recentWorkouts.map((w, idx) => (
                      <View key={w.id || idx} style={localStyles.itemCard}>
                        <View
                          style={[
                            localStyles.itemRankBox,
                            { backgroundColor: 'rgba(48, 209, 88, 0.15)', borderColor: 'rgba(48, 209, 88, 0.3)' },
                          ]}
                        >
                          <Text style={{ fontSize: 16 }}>⚡</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={localStyles.itemTitle}>{w.programName}</Text>
                          <Text style={localStyles.itemSubtitle}>
                            {w.date} • {w.durationMinutes} min • {w.totalSets} séries
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[localStyles.itemMetricHighlight, { color: Colors.success }]}>
                            {w.totalVolumeKg.toLocaleString()} kg
                          </Text>
                          <Text style={localStyles.itemMetricSub}>Tonnage déplacé</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* ACTIONS EN PIED DE PROFIL */}
              <View style={localStyles.footerActions}>
                {!showcase.isCurrentUser && !isAlreadyFriend && onInviteAthlete && athlete && (
                  <Button
                    title="+ Inviter en ami"
                    variant="primary"
                    size="md"
                    onPress={() => {
                      onInviteAthlete(athlete);
                      onClose();
                    }}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title="Fermer"
                  variant={showcase.isCurrentUser || isAlreadyFriend ? 'primary' : 'outline'}
                  size="md"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingContainer: {
    paddingVertical: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollBody: {
    padding: 20,
    paddingTop: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarWrapper: {
    borderRadius: 36,
    padding: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleSection: {
    flex: 1,
  },
  usernameText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  youBadge: {
    backgroundColor: `${Colors.primary}25`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: `${Colors.primary}50`,
  },
  youBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  trainerTitleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  friendCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  friendCodeLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  friendCodeValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  friendCodeCopyIcon: {
    fontSize: 11,
    marginLeft: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.cardElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  segmentTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.cardElevated,
    borderRadius: 9999,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabContent: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardElevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 10,
  },
  itemRankBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRankText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemMetricHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  itemMetricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
});
