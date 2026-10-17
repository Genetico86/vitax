import React from 'react';
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
import { arenaStyles as styles } from '../styles/arenaStyles';
import { LeaderboardFilter, WEB_APP_URL } from '../hooks/useArenaData';

interface LeaderboardTabProps {
  leaderboardData: {
    league: LeagueConfig;
    entries: LeaderboardEntry[];
    currentUserRank: number;
    timeRemainingText: string;
    totalParticipants: number;
  };
  leaderboardFilter: LeaderboardFilter;
  onFilterChange: (filter: LeaderboardFilter) => void;
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
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  leaderboardData,
  leaderboardFilter,
  onFilterChange,
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
}) => {
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
              <View style={styles.pendingAvatarBox}>
                <Text style={{ fontSize: 24 }}>{req.senderAvatarEmoji || '⚡'}</Text>
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

      {/* Bannière de la Ligue Courante */}
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

      {/* Rang de l'athlète mis en valeur */}
      <View style={styles.myRankCard}>
        <Text style={styles.myRankLabel}>
          {leaderboardFilter === 'friends'
            ? 'Votre Rang parmi vos Amis :'
            : 'Votre Classement Général :'}
        </Text>
        <Text style={styles.myRankValue}>#{leaderboardData.currentUserRank}</Text>
        <Text style={styles.myRankHint}>
          {leaderboardFilter === 'friends'
            ? `Sur ${leaderboardData.totalParticipants} athlète(s) dans votre cercle privé`
            : leaderboardData.currentUserRank <= leaderboardData.league.promotionSpots
            ? '✨ En zone de promotion ! Continuez ainsi.'
            : 'Entraînez-vous pour grimper au classement avant dimanche !'}
        </Text>
      </View>

      {/* MODULE D'INVITATION À INSTALLER L'APPLICATION AVEC LIEN WEB */}
      <Card style={styles.inviteApkCard}>
        <View style={styles.inviteApkTopRow}>
          <View style={styles.inviteApkIconBox}>
            <Text style={{ fontSize: 22 }}>📲</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.inviteApkBadgeRow}>
              <Text style={styles.inviteApkTitle}>Inviter des amis sur Vitax</Text>
              <Badge label="App Web & Mobile" color="rgba(0, 229, 255, 0.2)" textColor="#00E5FF" />
            </View>
            <Text style={styles.inviteApkSub}>
              Partagez l’application web à vos partenaires de sport pour qu’ils vous rejoignent directement sur mobile ou ordinateur et vous défient dans l’arène.
            </Text>
          </View>
        </View>

        <View style={styles.inviteApkLinkBox}>
          <Text style={styles.inviteApkUrlText} numberOfLines={1}>
            {WEB_APP_URL}
          </Text>
        </View>

        <View style={styles.inviteApkButtonsRow}>
          <TouchableOpacity
            style={styles.inviteApkShareBtn}
            onPress={onShareWebInvite}
            activeOpacity={0.8}
          >
            <Text style={styles.inviteApkShareBtnText}>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 10 }}>
        <Text style={styles.sectionHeaderTitle}>
          {leaderboardFilter === 'friends'
            ? `Cercle d’Amis (${leaderboardData.entries.length})`
            : `Tous les Athlètes (${leaderboardData.entries.length})`}
        </Text>
        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
          Reset dimanche 23h59
        </Text>
      </View>

      {leaderboardData.entries.length === 0 ? (
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
        leaderboardData.entries.map((entry) => {
          const isPromoted =
            leaderboardFilter === 'global' &&
            entry.rank <= leaderboardData.league.promotionSpots;

          const isAlreadyFriend =
            entry.isFriend ||
            friendsList.some(
              (f) =>
                f.friendId === entry.userId ||
                (entry.friendCode && f.friendCode === entry.friendCode)
            );

          const displayedXp =
            entry.totalXp !== undefined ? entry.totalXp : entry.weeklyXp;

          return (
            <View
              key={entry.userId}
              style={[
                styles.leaderboardRow,
                entry.isCurrentUser && styles.leaderboardRowCurrent,
              ]}
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
                <Text style={styles.entrySub}>
                  {entry.workoutsCount} séance(s) • {entry.totalTonnageKg.toLocaleString()} kg
                </Text>
              </View>

              <View style={styles.xpCol}>
                <Text style={styles.xpValue}>{displayedXp.toLocaleString()} XP</Text>
                {entry.weeklyXp > 0 ? (
                  <Text style={styles.weeklyXpSub}>+{entry.weeklyXp} hebdo</Text>
                ) : (
                  <Text style={styles.weeklyXpSubMuted}>Total profil</Text>
                )}
                {isPromoted && <Text style={styles.promotedBadge}>▲ Promu</Text>}
              </View>

              {leaderboardFilter === 'friends' && !entry.isCurrentUser && (
                <TouchableOpacity
                  style={styles.deleteFriendBtn}
                  onPress={() => onRemoveFriend(entry.userId, entry.username)}
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
                ) : (
                  <TouchableOpacity
                    style={styles.inviteAthleteBtn}
                    onPress={() => onInviteAthlete ? onInviteAthlete(entry) : null}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Inviter ${entry.username} en ami`}
                  >
                    <Text style={styles.inviteAthleteBtnText}>+ Inviter</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          );
        })
      )}
    </View>
  );
};
