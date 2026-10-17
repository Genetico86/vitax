import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { UserAvatar } from '../../common/UserAvatar';
import { FriendChallenge, CoOpRaidBoss } from '../../../types/social';
import { isDurationExercise, getExerciseUnitInfo } from '../../../utils/exerciseUnits';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface RaidsTabProps {
  raidsSubTab: 'challenges' | 'boss';
  onSubTabChange: (tab: 'challenges' | 'boss') => void;
  friendChallenges: FriendChallenge[];
  raidBoss: CoOpRaidBoss | null;
  onOpenCreateChallenge: () => void;
  onTakeOnChallenge: (chlg: FriendChallenge) => void;
  onClaimReward: () => void;
  onStartRaidWorkout: () => void;
}

export const RaidsTab: React.FC<RaidsTabProps> = ({
  raidsSubTab,
  onSubTabChange,
  friendChallenges,
  raidBoss,
  onOpenCreateChallenge,
  onTakeOnChallenge,
  onClaimReward,
  onStartRaidWorkout,
}) => {
  return (
    <View>
      {/* SOUS-SÉLECTEUR : DÉFIS 1 VS 1 OU RAID BOSS */}
      <View style={styles.raidsSubNav}>
        <TouchableOpacity
          style={[
            styles.raidsSubNavBtn,
            raidsSubTab === 'challenges' && styles.raidsSubNavBtnActive,
          ]}
          onPress={() => onSubTabChange('challenges')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.raidsSubNavText,
              raidsSubTab === 'challenges' && styles.raidsSubNavTextActive,
            ]}
          >
            🥊 Défis 1 vs 1 ({friendChallenges.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.raidsSubNavBtn,
            raidsSubTab === 'boss' && styles.raidsSubNavBtnActive,
          ]}
          onPress={() => onSubTabChange('boss')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.raidsSubNavText,
              raidsSubTab === 'boss' && styles.raidsSubNavTextActive,
            ]}
          >
            🏋️‍♂️ Défi Co-op 50t
          </Text>
        </TouchableOpacity>
      </View>

      {/* SOUS-ONGLET 1 : DÉFIS 1 VS 1 */}
      {raidsSubTab === 'challenges' && (
        <View>
          <View style={styles.challengeHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeaderTitle}>Défis entre Amis 🥊</Text>
              <Text style={styles.sectionHeaderSubtitle}>
                Défiez vos partenaires sur un exercice ou un programme avec vos stats à battre !
              </Text>
            </View>
            <TouchableOpacity
              style={styles.newChallengeBtn}
              onPress={onOpenCreateChallenge}
              activeOpacity={0.8}
            >
              <Text style={styles.newChallengeBtnText}>+ Créer un Défi</Text>
            </TouchableOpacity>
          </View>

          {friendChallenges.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>🥊</Text>
              <Text style={styles.emptyCardTitle}>Aucun défi actif pour l’instant</Text>
              <Text style={styles.emptyCardSub}>
                Lancez un défi à vos amis sur votre exercice favori ou un programme complet !
              </Text>
              <Button
                title="Créer mon premier Défi ⚔️"
                variant="primary"
                size="md"
                onPress={onOpenCreateChallenge}
                style={{ marginTop: 14 }}
              />
            </Card>
          ) : (
            friendChallenges.map((chlg) => {
              const isBeaten = chlg.status === 'beaten';
              const isDuration = isDurationExercise({ id: chlg.exerciseId, name: chlg.exerciseName });
              const unitInfo = getExerciseUnitInfo({ id: chlg.exerciseId, name: chlg.exerciseName });
              return (
                <Card key={chlg.id} style={styles.challengeCard}>
                  {/* En-tête Défi */}
                  <View style={styles.challengeCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={styles.challengeAvatar}>
                        <Text style={{ fontSize: 22 }}>{chlg.creatorAvatarEmoji || '⚡'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.challengeCreatorName}>
                          {chlg.creatorName}
                          {chlg.targetFriendName ? (
                            <Text style={{ color: '#00E5FF' }}> ➔ {chlg.targetFriendName}</Text>
                          ) : (
                            <Text style={{ color: Colors.textMuted }}> (Tous)</Text>
                          )}
                        </Text>
                        <Text style={styles.challengeTypeBadge}>
                          {chlg.type === 'program'
                            ? '📋 DÉFI PROGRAMME'
                            : isDuration
                            ? '🏃 DÉFI CARDIO'
                            : '🏋️ DÉFI EXERCICE'}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.challengeStatusPill,
                        isBeaten ? styles.challengeStatusPillBeaten : styles.challengeStatusPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.challengeStatusPillText,
                          isBeaten ? { color: '#10B981' } : { color: '#FF5A1F' },
                        ]}
                      >
                        {isBeaten ? `🏆 Battu par ${chlg.winnerName || 'un rival'}` : '⚔️ ACTIF'}
                      </Text>
                    </View>
                  </View>

                  {/* Titre & Cibles */}
                  <Text style={styles.challengeTitleText}>{chlg.title}</Text>

                  {/* Stats en Objectif à Dépasser */}
                  <View style={styles.challengeStatsRow}>
                    {chlg.type === 'exercise' ? (
                      <>
                        {isDuration ? (
                          <>
                            {chlg.targetWeightKg !== undefined && chlg.targetWeightKg > 0 && (
                              <View style={styles.challengeStatItem}>
                                <Text style={styles.challengeStatLabel}>
                                  {unitInfo.loadLabel === 'VITESSE' ? 'Vitesse cible' : 'Intensité'}
                                </Text>
                                <Text style={styles.challengeStatValue}>
                                  {chlg.targetWeightKg} {unitInfo.loadUnit}
                                </Text>
                              </View>
                            )}
                            <View style={styles.challengeStatItem}>
                              <Text style={styles.challengeStatLabel}>Durée cible</Text>
                              <Text style={styles.challengeStatValue}>
                                {chlg.targetDurationSeconds
                                  ? Math.round(chlg.targetDurationSeconds / 60)
                                  : chlg.targetReps || 15}{' '}
                                min
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            {chlg.targetWeightKg !== undefined && chlg.targetWeightKg > 0 && (
                              <View style={styles.challengeStatItem}>
                                <Text style={styles.challengeStatLabel}>Charge cible</Text>
                                <Text style={styles.challengeStatValue}>{chlg.targetWeightKg} kg</Text>
                              </View>
                            )}
                            <View style={styles.challengeStatItem}>
                              <Text style={styles.challengeStatLabel}>Reps cibles</Text>
                              <Text style={styles.challengeStatValue}>{chlg.targetReps || 10} reps</Text>
                            </View>
                          </>
                        )}
                      </>
                    ) : (
                      <View style={styles.challengeStatItem}>
                        <Text style={styles.challengeStatLabel}>Tonnage cible à battre</Text>
                        <Text style={styles.challengeStatValue}>
                          {(chlg.targetVolumeKg || 3000).toLocaleString()} kg
                        </Text>
                      </View>
                    )}
                    <View style={styles.challengeStatItem}>
                      <Text style={styles.challengeStatLabel}>Récompense</Text>
                      <Text style={[styles.challengeStatValue, { color: '#FF5A1F' }]}>
                        +{chlg.rewardXp || 150} XP ⚡
                      </Text>
                    </View>
                  </View>

                  {chlg.instructions ? (
                    <View style={styles.challengeInstructionsBox}>
                      <Text style={styles.challengeInstructionsText}>
                        💬 « {chlg.instructions} »
                      </Text>
                    </View>
                  ) : null}

                  {/* Action Bouton */}
                  <View style={{ marginTop: 12 }}>
                    <Button
                      title="🥊 Relever le Défi (Lancer la séance) ▶"
                      variant="primary"
                      size="md"
                      onPress={() => onTakeOnChallenge(chlg)}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </View>
      )}

      {/* SOUS-ONGLET 2 : RAID BOSS CO-OP */}
      {raidsSubTab === 'boss' && raidBoss && (
        <View>
          <Card style={styles.raidBossCard}>
            <View style={styles.raidHeaderRow}>
              <View style={styles.raidBossBadge}>
                <Text style={styles.raidBossBadgeText}>RAID BOSS CO-OP</Text>
              </View>
              <Text style={styles.raidTypeTag}>{raidBoss.bossType}</Text>
            </View>

            <View style={styles.bossCenterRow}>
              <View style={styles.bossAvatarBox}>
                <Text style={{ fontSize: 64 }}>{raidBoss.bossEmoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bossName}>{raidBoss.bossName}</Text>
                <Text style={styles.bossDesc}>{raidBoss.description}</Text>
              </View>
            </View>

            {/* Jauge Collective de Points de Vie / Tonnage */}
            <View style={styles.gaugeContainer}>
              <View style={styles.gaugeHeader}>
                <Text style={styles.gaugeLabel}>Tonnage d’Équipe :</Text>
                <Text style={styles.gaugeNumbers}>
                  {raidBoss.currentProgress.toLocaleString()} /{' '}
                  {raidBoss.targetValue.toLocaleString()} {raidBoss.targetMetricLabel}
                </Text>
              </View>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round((raidBoss.currentProgress / raidBoss.targetValue) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.gaugePercent}>
                {Math.round((raidBoss.currentProgress / raidBoss.targetValue) * 100)}% accompli
              </Text>
            </View>

            {/* Bouton Victoire ou Entraînement */}
            {raidBoss.status === 'victory' ? (
              <View style={styles.victoryBox}>
                <Text style={styles.victoryTitle}>🎉 BOSS VAINCU PAR L’ÉQUIPE !</Text>
                <Text style={styles.victorySub}>{raidBoss.rewardDescription}</Text>
                {!raidBoss.hasClaimedReward ? (
                  <Button
                    title={`🎁 Réclamer mes +${raidBoss.rewardXp || 500} XP`}
                    variant="primary"
                    size="md"
                    onPress={onClaimReward}
                    style={{ marginTop: 10 }}
                  />
                ) : (
                  <Text style={styles.claimedNotice}>
                    ✓ Récompense déjà récupérée cette semaine !
                  </Text>
                )}
              </View>
            ) : (
              <Button
                title="⚔️ Combattre le Boss (Lancer la séance de Raid) ▶"
                variant="primary"
                size="md"
                onPress={onStartRaidWorkout}
                style={{ marginTop: 14 }}
              />
            )}
          </Card>

          {/* Contributions d'Équipe */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>
            Contributions de l’Équipe ({raidBoss.participants.length} athlètes)
          </Text>

          {raidBoss.participants.map((p, idx) => (
            <View
              key={p.userId}
              style={[
                styles.participantRow,
                p.isCurrentUser && styles.participantRowCurrent,
              ]}
            >
              <Text style={styles.participantRank}>#{idx + 1}</Text>
              <UserAvatar
                avatarUrl={p.avatarUrl}
                fallbackEmoji={p.avatarPokemonEmoji || '⚡'}
                size={32}
                style={{ borderWidth: 0, marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.participantName, p.isCurrentUser && { color: Colors.primary }]}>
                  {p.username} {p.isCurrentUser && '(Vous)'}
                </Text>
                <Text style={styles.participantVal}>
                  {p.contributionValue.toLocaleString()} kg soulevés ({p.percentage}%)
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
