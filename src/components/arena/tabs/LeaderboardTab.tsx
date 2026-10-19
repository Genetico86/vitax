import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { showAlert } from '../../../utils/alert';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { Button } from '../../common/Button';
import { UserAvatar } from '../../common/UserAvatar';
import {
  LeaderboardEntry,
  LeagueConfig,
  FriendRequest,
  FriendGift,
  FriendEntry,
  TrainerProfile,
} from '../../../types/social';
import { computeLevelInfoForXp } from '../../../services/gamificationService';
import { arenaStyles as styles } from '../styles/arenaStyles';
import { LeaderboardFilter, LeaderboardTimeframe, WEB_APP_URL } from '../hooks/useArenaData';

interface LeaderboardTabProps {
  leaderboardData: {
    league: LeagueConfig;
    entries: LeaderboardEntry[];
    currentUserRank: number;
    timeRemainingText: string;
    totalParticipants: number;
    timeframe?: LeaderboardTimeframe;
  };
  leaderboardFilter: LeaderboardFilter;
  onFilterChange: (filter: LeaderboardFilter) => void;
  timeframe?: LeaderboardTimeframe;
  onTimeframeChange?: (timeframe: LeaderboardTimeframe) => void;
  pendingRequests: FriendRequest[];
  friendGifts: {
    sent: FriendGift[];
    received: FriendGift[];
    unlockedUnclaimedCount: number;
  };
  friendsList: FriendEntry[];
  profile: TrainerProfile | null;
  onAcceptRequest: (id: string) => void;
  onDeclineRequest: (id: string) => void;
  onShareWebInvite: () => void;
  onShareFriendCode: () => void;
  onOpenAddFriend: () => void;
  onOpenManageFriends: () => void;
  onOpenCreateGift: () => void;
  onSimulateGift: () => void;
  onClaimGift: (gift: FriendGift) => void;
  onRemoveFriend: (id: string, name: string) => void;
  onInviteAthlete?: (entry: LeaderboardEntry) => void;
  onSelectAthlete?: (entry: LeaderboardEntry) => void;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  leaderboardData,
  leaderboardFilter,
  onFilterChange,
  timeframe: initialTimeframe,
  onTimeframeChange,
  pendingRequests,
  friendGifts,
  friendsList,
  profile,
  onAcceptRequest,
  onDeclineRequest,
  onShareWebInvite,
  onShareFriendCode,
  onOpenAddFriend,
  onOpenManageFriends,
  onOpenCreateGift,
  onSimulateGift,
  onClaimGift,
  onRemoveFriend,
  onInviteAthlete,
  onSelectAthlete,
}) => {
  const [localTimeframe, setLocalTimeframe] = useState<LeaderboardTimeframe>(
    initialTimeframe || leaderboardData.timeframe || 'weekly'
  );

  const currentTimeframe = initialTimeframe || localTimeframe;

  const handleTimeframeChange = (tf: LeaderboardTimeframe) => {
    setLocalTimeframe(tf);
    if (onTimeframeChange) {
      onTimeframeChange(tf);
    }
  };

  const sortedEntries = useMemo(() => {
    const list = [...leaderboardData.entries];
    if (currentTimeframe === 'weekly') {
      list.sort((a, b) => {
        if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
        return (b.totalXp || 0) - (a.totalXp || 0);
      });
    } else {
      list.sort((a, b) => {
        const aTotal = a.totalXp || 0;
        const bTotal = b.totalXp || 0;
        if (bTotal !== aTotal) return bTotal - aTotal;
        return (b.workoutsCount || 0) - (a.workoutsCount || 0);
      });
    }
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [leaderboardData.entries, currentTimeframe]);

  const currentUserEntry = useMemo(() => {
    return sortedEntries.find((e) => e.isCurrentUser) || null;
  }, [sortedEntries]);

  const effectiveUserRank = useMemo(() => {
    return currentUserEntry ? currentUserEntry.rank : leaderboardData.currentUserRank;
  }, [currentUserEntry, leaderboardData.currentUserRank]);

  const currentUserLevelInfo = useMemo(() => {
    const totalXp = currentUserEntry?.totalXp ?? profile?.totalXp ?? 0;
    return computeLevelInfoForXp(totalXp);
  }, [currentUserEntry?.totalXp, profile?.totalXp]);

  return (
    <View>
      {/* DEMANDES D'AMIS EN ATTENTE */}
      {pendingRequests.length > 0 && (
        <View style={styles.pendingContainer}>
          <View style={styles.pendingHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.pendingPulseDot} />
              <Text style={styles.pendingSectionTitle}>
                {pendingRequests.length} DEMANDE{pendingRequests.length > 1 ? 'S' : ''} D’AMI EN ATTENTE 👥
              </Text>
            </View>
          </View>

          {pendingRequests.map((req) => (
            <View key={req.id} style={styles.pendingCardRow}>
              <View style={[styles.pendingAvatarBox, { padding: 0, overflow: 'hidden', backgroundColor: 'transparent' }]}>
                <UserAvatar
                  avatarUrl={req.senderAvatarUrl}
                  fallbackEmoji={req.senderAvatarEmoji || '⚡'}
                  size={42}
                  style={{ borderWidth: 0 }}
                  userName={req.senderName}
                  userSubtitle={`Code Ami : ${req.senderCode} • ${req.senderTrainerTitle || 'Athlète'}`}
                  enableEnlarge
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingSenderTitle}>{req.senderName}</Text>
                <Text style={styles.pendingSenderCode}>
                  Code : <Text style={{ color: '#38BDF8', fontWeight: '800' }}>{req.senderCode}</Text> • {req.senderTrainerTitle || 'Athlète'}
                </Text>
              </View>
              <View style={styles.pendingActionBtns}>
                <TouchableOpacity
                  style={styles.pendingRejectBtn}
                  onPress={() => onDeclineRequest(req.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pendingRejectBtnText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pendingAcceptBtn}
                  onPress={() => onAcceptRequest(req.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pendingAcceptBtnText}>Accepter ✅</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* BANNIÈRE CADEAUX DÉVERROUILLÉS EN ATTENTE */}
      {friendGifts.unlockedUnclaimedCount > 0 && (
        <TouchableOpacity
          style={styles.unlockedGiftAlertBanner}
          onPress={() => onFilterChange('friends')}
          activeOpacity={0.85}
        >
          <View style={styles.unlockedGiftAlertIcon}>
            <Text style={{ fontSize: 26 }}>🎁</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.unlockedGiftAlertTitle}>
              {friendGifts.unlockedUnclaimedCount} CADEAU{friendGifts.unlockedUnclaimedCount > 1 ? 'X' : ''} DÉBLOQUÉ{friendGifts.unlockedUnclaimedCount > 1 ? 'S' : ''} ! 🎉
            </Text>
            <Text style={styles.unlockedGiftAlertSub}>
              Vos séances ont payé ! Cliquez ici pour réclamer votre récompense.
            </Text>
          </View>
          <Text style={styles.unlockedGiftAlertArrow}>➔</Text>
        </TouchableOpacity>
      )}

      {/* SÉLECTEUR MAJEUR DU TYPE DE CLASSEMENT : HEBDO (LIGUE) VS PERMANENT (TOTAL EXP) */}
      <View style={styles.timeframeSegmentContainer}>
        <TouchableOpacity
          style={[
            styles.timeframeSegmentBtn,
            currentTimeframe === 'weekly' && styles.timeframeSegmentBtnActive,
          ]}
          onPress={() => handleTimeframeChange('weekly')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: currentTimeframe === 'weekly' }}
          accessibilityLabel="Afficher le classement hebdomadaire de la ligue"
        >
          <Text style={styles.timeframeSegmentIcon}>⚡</Text>
          <View>
            <Text
              style={[
                styles.timeframeSegmentTitle,
                currentTimeframe === 'weekly' && styles.timeframeSegmentTitleActive,
              ]}
            >
              Classement Hebdo
            </Text>
            <Text
              style={[
                styles.timeframeSegmentSub,
                currentTimeframe === 'weekly' && styles.timeframeSegmentSubActive,
              ]}
            >
              Ligue • Reset dim. 23h59
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.timeframeSegmentBtn,
            currentTimeframe === 'allTime' && styles.timeframeSegmentBtnActivePermanent,
          ]}
          onPress={() => handleTimeframeChange('allTime')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: currentTimeframe === 'allTime' }}
          accessibilityLabel="Afficher le classement permanent basé sur le total d'expérience"
        >
          <Text style={styles.timeframeSegmentIcon}>🏆</Text>
          <View>
            <Text
              style={[
                styles.timeframeSegmentTitle,
                currentTimeframe === 'allTime' && styles.timeframeSegmentTitleActive,
              ]}
            >
              Classement Permanent
            </Text>
            <Text
              style={[
                styles.timeframeSegmentSub,
                currentTimeframe === 'allTime' && styles.timeframeSegmentSubActivePermanent,
              ]}
            >
              Panthéon • Total d’EXP
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* BANNIÈRE CONTEXTUELLE : HEBDO (LIGUE) VS PERMANENT (PANTHÉON TOTAL XP) */}
      {currentTimeframe === 'weekly' ? (
        <Card style={[styles.leagueBannerCard, { borderColor: leaderboardData.league.color }]}>
          <View style={styles.leagueBannerContent}>
            <View style={[styles.leagueIconCircle, { backgroundColor: `${leaderboardData.league.color}25` }]}>
              <Text style={{ fontSize: 28 }}>{leaderboardData.league.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.leagueBannerTitle}>{leaderboardData.league.name}</Text>
              <Text style={styles.leagueBannerSub}>
                Top {leaderboardData.league.promotionSpots} monte en ligue supérieure
              </Text>
            </View>
            <View style={styles.leagueTimeBadge}>
              <Text style={styles.leagueTimeText}>⏱ {leaderboardData.timeRemainingText}</Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card style={styles.permanentBannerCard}>
          <View style={styles.permanentBannerContent}>
            <View style={styles.permanentIconCircle}>
              <Text style={{ fontSize: 26 }}>👑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.permanentBannerTitle}>Panthéon des Athlètes</Text>
                <Badge label="Permanent" color="rgba(245, 158, 11, 0.2)" textColor="#F59E0B" />
              </View>
              <Text style={styles.permanentBannerSub}>
                Classement perpétuel basé sur le total d’EXP cumulée • Aucun reset
              </Text>
            </View>
            <View style={styles.permanentTrophyBadge}>
              <Text style={styles.permanentTrophyText}>🏆 Hall of Fame</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Rang de l'athlète mis en valeur */}
      {currentTimeframe === 'weekly' ? (
        <View style={styles.myRankCard}>
          <View style={styles.myRankTopRow}>
            <View>
              <Text style={styles.myRankLabel}>
                {leaderboardFilter === 'friends'
                  ? 'Votre Rang Amis (Cette Semaine) :'
                  : 'Votre Rang Ligue (Cette Semaine) :'}
              </Text>
              <Text style={styles.myRankValue}>#{effectiveUserRank}</Text>
            </View>
            <View style={styles.myRankWeeklyXpBox}>
              <Text style={styles.myRankWeeklyXpValue}>
                +{currentUserEntry?.weeklyXp ? currentUserEntry.weeklyXp.toLocaleString() : 0} XP
              </Text>
              <Text style={styles.myRankWeeklyXpSub}>Cette semaine</Text>
            </View>
          </View>
          <Text style={styles.myRankHint}>
            {leaderboardFilter === 'friends'
              ? `Sur ${sortedEntries.length} ami(s) dans votre cercle privé`
              : effectiveUserRank <= leaderboardData.league.promotionSpots
              ? '✨ En zone de promotion ! Continuez ainsi avant dimanche 23h59.'
              : 'Entraînez-vous pour grimper au classement avant dimanche 23h59 !'}
          </Text>
        </View>
      ) : (
        <View style={[styles.myRankCard, styles.myRankCardPermanent]}>
          <View style={styles.myRankTopRow}>
            <View>
              <Text style={styles.myRankLabel}>
                {leaderboardFilter === 'friends'
                  ? 'Votre Rang Amis (Permanent) :'
                  : 'Votre Classement Permanent (Tous les Temps) :'}
              </Text>
              <Text style={[styles.myRankValue, { color: '#F59E0B' }]}>#{effectiveUserRank}</Text>
            </View>
            <View style={styles.myRankPermanentXpBox}>
              <Text style={styles.myRankPermanentXpValue}>
                {(currentUserEntry?.totalXp || 0).toLocaleString()} XP
              </Text>
              <Text style={styles.myRankPermanentLevelSub}>
                Niv. {currentUserLevelInfo.level} • {currentUserLevelInfo.badgeName}
              </Text>
            </View>
          </View>
          <Text style={styles.myRankHint}>
            {leaderboardFilter === 'friends'
              ? `Sur ${sortedEntries.length} ami(s) • Total d'EXP accumulé sur l'ensemble de vos entraînements`
              : `Sur ${sortedEntries.length} athlètes • Votre total d'expérience détermine votre rang à vie dans l'arène.`}
          </Text>
        </View>
      )}

      {/* MODULE D'INVITATION À REJOINDRE L'APPLICATION AVEC LIEN WEB */}
      <Card style={styles.inviteWebCard}>
        <View style={styles.inviteWebTopRow}>
          <View style={styles.inviteWebIconBox}>
            <Text style={{ fontSize: 22 }}>🌐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.inviteWebBadgeRow}>
              <Text style={styles.inviteWebTitle}>Inviter des amis sur Vitax</Text>
              <Badge label="App Web PWA" color="rgba(0, 229, 255, 0.2)" textColor="#00E5FF" />
            </View>
            <Text style={styles.inviteWebSub}>
              Partagez l’application web à vos partenaires de sport pour qu’ils vous rejoignent directement sur smartphone ou ordinateur et vous défient dans l’arène.
            </Text>
          </View>
        </View>

        <View style={styles.inviteWebLinkBox}>
          <Text style={styles.inviteWebUrlText} numberOfLines={1}>
            {WEB_APP_URL}
          </Text>
        </View>

        <View style={styles.inviteWebButtonsRow}>
          <TouchableOpacity
            style={styles.inviteWebShareBtn}
            onPress={onShareWebInvite}
            activeOpacity={0.8}
          >
            <Text style={styles.inviteWebShareBtnText}>
              📤 Envoyer l’invitation (Lien Web + Code Ami)
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* FILTRE : CLASSEMENT GÉNÉRAL VS MES AMIS */}
      <View style={styles.filterSegmentContainer}>
        <TouchableOpacity
          style={[
            styles.filterSegmentBtn,
            leaderboardFilter === 'global' && styles.filterSegmentBtnActive,
          ]}
          onPress={() => onFilterChange('global')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterSegmentText,
              leaderboardFilter === 'global' && styles.filterSegmentTextActive,
            ]}
          >
            🌍 Classement Général
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterSegmentBtn,
            leaderboardFilter === 'friends' && styles.filterSegmentBtnActive,
          ]}
          onPress={() => onFilterChange('friends')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterSegmentText,
              leaderboardFilter === 'friends' && styles.filterSegmentTextActive,
            ]}
          >
            👥 Mes Amis
          </Text>
        </TouchableOpacity>
      </View>

      {/* BANDEAU EN MODE "MES AMIS" : CODE AMI + BOUTON AJOUTER */}
      {leaderboardFilter === 'friends' && profile && (
        <Card style={styles.friendsActionCard}>
          <View style={styles.friendsActionTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendsActionLabel}>Votre Code Ami unique :</Text>
              <Text style={styles.friendsActionCode}>{profile.friendCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.friendsShareBtn}
              onPress={onShareFriendCode}
              activeOpacity={0.8}
            >
              <Text style={styles.friendsShareBtnText}>📤 Partager</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.friendsActionBottom}>
            <Button
              title="+ Ajouter un ami"
              variant="primary"
              size="sm"
              onPress={onOpenAddFriend}
              style={{ flex: 1 }}
            />
            {friendsList.length > 0 && (
              <Button
                title={`Gérer (${friendsList.length})`}
                variant="outline"
                size="sm"
                onPress={onOpenManageFriends}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Card>
      )}

      {/* SECTION CADEAUX DE MOTIVATION ENTRE AMIS */}
      {leaderboardFilter === 'friends' && (
        <Card style={styles.giftsMainSectionCard}>
          <View style={styles.giftsHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.giftsSectionTitle}>🎁 Cadeaux de Motivation</Text>
                {friendGifts.unlockedUnclaimedCount > 0 && (
                  <View style={styles.giftsBadgeCount}>
                    <Text style={styles.giftsBadgeCountText}>
                      {friendGifts.unlockedUnclaimedCount} prêt{friendGifts.unlockedUnclaimedCount > 1 ? 's' : ''} !
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.giftsSectionSub}>
                Motive tes amis en leur promettant un cadeau qui se débloque lorsqu’ils atteignent un objectif d’XP !
              </Text>
            </View>
          </View>

          <View style={styles.giftsActionButtonsRow}>
            <TouchableOpacity
              style={styles.giftOfferBtn}
              onPress={() => {
                if (friendsList.length === 0) {
                  showAlert('Aucun ami', 'Ajoutez d’abord un ami avec son Code Ami pour lui envoyer un cadeau de motivation.');
                  onOpenAddFriend();
                } else {
                  onOpenCreateGift();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.giftOfferBtnText}>+ Offrir un Cadeau 🎁</Text>
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity
                style={styles.giftSimulateBtn}
                onPress={onSimulateGift}
                activeOpacity={0.7}
              >
                <Text style={styles.giftSimulateBtnText}>🧪 Simuler cadeau reçu</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* CADEAUX REÇUS */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.giftsSubHeaderTitle}>
              Cadeaux Reçus ({friendGifts.received.length})
            </Text>

            {friendGifts.received.length === 0 ? (
              <View style={styles.giftEmptyRow}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>📦</Text>
                <Text style={styles.giftEmptyText}>
                  Aucun cadeau reçu pour le moment. Vos amis peuvent vous promettre des récompenses débloquées à l’effort !
                </Text>
              </View>
            ) : (
              friendGifts.received.map((gift) => {
                const pct = Math.min(100, Math.round((gift.currentProgressXp / gift.targetXpGain) * 100));
                const isUnlocked = gift.status === 'unlocked';
                const isClaimed = gift.status === 'claimed';

                return (
                  <View
                    key={gift.id}
                    style={[
                      styles.giftCardItem,
                      isUnlocked && styles.giftCardItemUnlocked,
                      isClaimed && styles.giftCardItemClaimed,
                    ]}
                  >
                    <View style={styles.giftCardTop}>
                      <View style={[styles.giftAvatarCircle, { overflow: 'hidden', padding: 0 }]}>
                        <UserAvatar
                          avatarUrl={gift.senderAvatarUrl}
                          fallbackEmoji={gift.senderAvatarEmoji || '⚡'}
                          size={36}
                          style={{ borderWidth: 0 }}
                          userName={gift.senderName}
                          userSubtitle={`Cadeau : ${gift.giftName}`}
                          enableEnlarge
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.giftSenderText}>De la part de {gift.senderName}</Text>
                        <Text style={styles.giftTitleText}>🎁 {gift.giftName}</Text>
                        {gift.personalMessage ? (
                          <Text style={styles.giftPersonalMsg}>« {gift.personalMessage} »</Text>
                        ) : null}
                      </View>
                      <View>
                        {isClaimed ? (
                          <View style={styles.giftBadgeClaimed}>
                            <Text style={styles.giftBadgeClaimedText}>Réclamé ✅</Text>
                          </View>
                        ) : isUnlocked ? (
                          <View style={styles.giftBadgeUnlocked}>
                            <Text style={styles.giftBadgeUnlockedText}>DÉBLOQUÉ ! 🎉</Text>
                          </View>
                        ) : (
                          <View style={styles.giftBadgeActive}>
                            <Text style={styles.giftBadgeActiveText}>En cours ⏳</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* BARRE DE PROGRESSION XP */}
                    <View style={styles.giftProgressTrack}>
                      <View style={[styles.giftProgressBar, { width: `${pct}%` }]} />
                    </View>

                    <View style={styles.giftProgressStatsRow}>
                      <Text style={styles.giftProgressStatsLeft}>
                        Progression : <Text style={{ color: '#FF7A45', fontWeight: '800' }}>{gift.currentProgressXp}</Text> / {gift.targetXpGain} XP ({pct}%)
                      </Text>
                      <Text style={styles.giftProgressStatsRight}>
                        {isClaimed
                          ? 'Objectif atteint !'
                          : isUnlocked
                          ? 'Prêt à réclamer !'
                          : `+${Math.max(0, gift.targetXpGain - gift.currentProgressXp)} XP restants`}
                      </Text>
                    </View>

                    {/* BOUTON RÉCLAMER SI DÉVERROUILLÉ */}
                    {isUnlocked && (
                      <TouchableOpacity
                        style={styles.claimGiftActionBtn}
                        onPress={() => onClaimGift(gift)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.claimGiftActionBtnText}>
                          🎉 Réclamer mon Cadeau auprès de {gift.senderName} !
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* CADEAUX OFFERTS AUX AMIS */}
          {friendGifts.sent.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.giftsSubHeaderTitle}>
                Cadeaux Offerts à vos Amis ({friendGifts.sent.length})
              </Text>
              {friendGifts.sent.map((gift) => {
                const pct = Math.min(100, Math.round((gift.currentProgressXp / gift.targetXpGain) * 100));
                return (
                  <View key={gift.id} style={styles.giftSentCardItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.giftSentRecipientText}>
                        Pour <Text style={{ color: '#38BDF8', fontWeight: '800' }}>{gift.receiverName}</Text>
                      </Text>
                      <Text style={styles.giftSentStatusText}>
                        {gift.status === 'claimed'
                          ? 'Réclamé ✅'
                          : gift.status === 'unlocked'
                          ? 'Débloqué par l’ami ! 🎁'
                          : `${gift.currentProgressXp} / ${gift.targetXpGain} XP (${pct}%)`}
                      </Text>
                    </View>
                    <Text style={styles.giftSentTitleText}>🎁 {gift.giftName}</Text>
                    <View style={styles.giftSentProgressTrack}>
                      <View style={[styles.giftSentProgressBar, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {/* Liste des concurrents du classement */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 6 }}>
        <Text style={styles.sectionHeaderTitle}>
          {currentTimeframe === 'weekly'
            ? leaderboardFilter === 'friends'
              ? `Cercle d’Amis (${sortedEntries.length})`
              : `Athlètes de la Semaine (${sortedEntries.length})`
            : leaderboardFilter === 'friends'
            ? `Panthéon Amis (${sortedEntries.length})`
            : `Panthéon Permanent (${sortedEntries.length})`}
        </Text>
        <Text style={{ color: currentTimeframe === 'allTime' ? '#F59E0B' : Colors.textMuted, fontSize: 11, fontWeight: '700' }}>
          {currentTimeframe === 'weekly' ? 'Reset dimanche 23h59' : 'XP Totale Cumulée (À Vie)'}
        </Text>
      </View>

      {sortedEntries.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 6 }}>👥</Text>
          <Text style={styles.emptyCardTitle}>Aucun ami pour le moment</Text>
          <Text style={styles.emptyCardSub}>
            Partagez votre Code Ami ({profile?.friendCode}) ou ajoutez celui de vos partenaires pour comparer vos séances !
          </Text>
          <Button
            title="+ Ajouter un premier ami"
            variant="primary"
            size="sm"
            onPress={onOpenAddFriend}
            style={{ marginTop: 12, alignSelf: 'center' }}
          />
        </Card>
      ) : (
        sortedEntries.map((entry) => {
          const isPromoted =
            currentTimeframe === 'weekly' &&
            leaderboardFilter === 'global' &&
            entry.rank <= leaderboardData.league.promotionSpots;

          const isFirst = currentTimeframe === 'allTime' && entry.rank === 1;
          const isSecond = currentTimeframe === 'allTime' && entry.rank === 2;
          const isThird = currentTimeframe === 'allTime' && entry.rank === 3;

          const isAlreadyFriend =
            entry.isFriend ||
            friendsList.some(
              (f) =>
                f.friendId === entry.userId ||
                (entry.friendCode && f.friendCode === entry.friendCode)
            );

          const workoutsLabel =
            currentTimeframe === 'weekly'
              ? `${entry.weeklyWorkoutsCount ?? (entry.isCurrentUser ? 0 : entry.workoutsCount)} séance(s) cette sem.`
              : `${entry.workoutsCount} séance(s) au total`;

          const entryLevel = computeLevelInfoForXp(entry.totalXp || 0);

          return (
            <TouchableOpacity
              key={entry.userId}
              style={[
                styles.leaderboardRow,
                entry.isCurrentUser && styles.leaderboardRowCurrent,
                isFirst && styles.leaderboardRowFirst,
                isSecond && styles.leaderboardRowSecond,
                isThird && styles.leaderboardRowThird,
              ]}
              onPress={() => onSelectAthlete ? onSelectAthlete(entry) : null}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le profil de ${entry.username}`}
            >
              <View style={styles.rankCol}>
                <Text
                  style={[
                    styles.rankNumber,
                    entry.rank === 1 && styles.rank1,
                    entry.rank === 2 && styles.rank2,
                    entry.rank === 3 && styles.rank3,
                  ]}
                >
                  {entry.rank === 1
                    ? '🥇'
                    : entry.rank === 2
                    ? '🥈'
                    : entry.rank === 3
                    ? '🥉'
                    : `#${entry.rank}`}
                </Text>
              </View>

              <View style={[styles.entryAvatar, { overflow: 'hidden', padding: 0 }]}>
                <UserAvatar
                  avatarUrl={entry.avatarUrl}
                  fallbackEmoji={entry.avatarPokemonEmoji || '⚡'}
                  size={36}
                  style={{ borderWidth: 0 }}
                  userName={entry.username}
                  userSubtitle={`Rang #${entry.rank} • ${workoutsLabel} • ${entry.totalTonnageKg.toLocaleString()} kg`}
                  enableEnlarge
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.entryName,
                      entry.isCurrentUser && styles.entryNameCurrent,
                    ]}
                  >
                    {entry.username}
                  </Text>
                  {entry.isCurrentUser && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>VOUS</Text>
                    </View>
                  )}
                </View>

                {currentTimeframe === 'allTime' ? (
                  <>
                    <View style={styles.permanentLevelBadge}>
                      <Text style={styles.permanentLevelText}>
                        Niv. {entryLevel.level} • {entryLevel.badgeEmoji} {entry.trainerTitle || entryLevel.badgeName}
                      </Text>
                    </View>
                    <Text style={styles.entrySub}>
                      {workoutsLabel} • {entry.totalTonnageKg.toLocaleString()} kg
                    </Text>
                  </>
                ) : (
                  <Text style={styles.entrySub}>
                    {workoutsLabel} • {entry.totalTonnageKg.toLocaleString()} kg
                  </Text>
                )}
              </View>

              <View style={styles.xpCol}>
                {currentTimeframe === 'weekly' ? (
                  <>
                    <Text style={styles.xpValue}>
                      {entry.weeklyXp > 0 ? `+${entry.weeklyXp.toLocaleString()} XP` : '0 XP'}
                    </Text>
                    <Text style={styles.weeklyXpSub}>
                      Total : {(entry.totalXp || 0).toLocaleString()} XP
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.permanentXpValue}>
                      🏆 {(entry.totalXp || 0).toLocaleString()} XP
                    </Text>
                    <Text style={styles.weeklyXpSubMuted}>
                      {entry.workoutsCount} séance(s)
                    </Text>
                  </>
                )}
                {isPromoted && <Text style={styles.promotedBadge}>▲ Promu</Text>}
              </View>

              <Text style={{ fontSize: 16, color: Colors.textMuted, marginHorizontal: 2 }}>›</Text>

              {leaderboardFilter === 'friends' && !entry.isCurrentUser && (
                <TouchableOpacity
                  style={styles.deleteFriendBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onRemoveFriend(entry.userId, entry.username);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              )}

              {leaderboardFilter === 'global' && !entry.isCurrentUser && (
                isAlreadyFriend ? (
                  <View style={styles.friendBadge}>
                    <Text style={styles.friendBadgeText}>✓ Ami</Text>
                  </View>
                ) : entry.isBot || entry.userId.startsWith('vtx_') ? (
                  <View style={[styles.friendBadge, { opacity: 0.75 }]}>
                    <Text style={styles.friendBadgeText}>🤖 Coach IA</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.inviteAthleteBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (onInviteAthlete) {
                        onInviteAthlete(entry);
                      }
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Inviter ${entry.username} en ami`}
                  >
                    <Text style={styles.inviteAthleteBtnText}>+ Inviter</Text>
                  </TouchableOpacity>
                )
              )}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};
