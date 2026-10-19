import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { FriendGift, LeaderboardEntry } from '../../types/social';
import { useArenaData } from '../../components/arena/hooks/useArenaData';
import { arenaStyles as styles } from '../../components/arena/styles/arenaStyles';
import { ArenaHeader } from '../../components/arena/ArenaHeader';
import { LeaderboardTab } from '../../components/arena/tabs/LeaderboardTab';
import { RaidsTab } from '../../components/arena/tabs/RaidsTab';
import { AddFriendModal } from '../../components/arena/modals/AddFriendModal';
import { ManageFriendsModal } from '../../components/arena/modals/ManageFriendsModal';
import { TrainerAuthModal } from '../../components/arena/modals/TrainerAuthModal';
import { CreateChallengeModal } from '../../components/arena/modals/CreateChallengeModal';
import { CreateGiftModal } from '../../components/arena/modals/CreateGiftModal';
import { CelebrateGiftModal } from '../../components/arena/modals/CelebrateGiftModal';
import { AthleteProfileModal } from '../../components/arena/modals/AthleteProfileModal';

export default function ArenaScreen() {
  const params = useLocalSearchParams<{
    openChallenge?: string;
    challengeType?: 'exercise' | 'program';
    exerciseId?: string;
    programId?: string;
    targetWeight?: string;
    targetReps?: string;
    targetVolume?: string;
  }>();

  const isDirectChallenge = params.openChallenge === '1' || params.openChallenge === 'true';

  const {
    activeTab,
    setActiveTab,
    leaderboardFilter,
    setLeaderboardFilter,
    raidsSubTab,
    setRaidsSubTab,
    profile,
    isLoggedIn,
    loading,
    friendsList,
    leaderboardData,
    raidBoss,
    pendingRequests,
    friendGifts,
    friendChallenges,
    allExercises,
    allPrograms,
    refreshing,
    onRefresh,
    handleRemoveFriend,
    handleShareFriendCode,
    handleShareWebInvite,
    handleAddFriend,
    handleInviteAthlete,
    handleAcceptRequest,
    handleDeclineRequest,
    handleSimulateInvite,
    handleCreateGift,
    handleClaimGift,
    handleSimulateGift,
    handleAuthSubmit,
    handleLogout,
    handleClaimReward,
    handleCreateChallenge,
    handleTakeOnChallenge,
    handleStartRaidWorkout,
  } = useArenaData(isDirectChallenge ? 'raids' : undefined);

  // Modales d'interaction
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [manageFriendsModalVisible, setManageFriendsModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('login');
  const [authUsername, setAuthUsername] = useState('');

  const [manualChallengeModalOpen, setManualChallengeModalOpen] = useState(false);
  const [challengeDismissed, setChallengeDismissed] = useState(false);

  const createChallengeModalVisible = manualChallengeModalOpen || (isDirectChallenge && !challengeDismissed);

  const initialChallengeType: 'exercise' | 'program' =
    params.challengeType || (params.programId ? 'program' : 'exercise');
  const initialExerciseId = params.exerciseId;
  const initialProgramId = params.programId;
  const initialWeight = params.targetWeight ? parseFloat(params.targetWeight) : undefined;
  const initialReps = params.targetReps ? parseInt(params.targetReps, 10) : undefined;
  const initialVolume = params.targetVolume ? parseInt(params.targetVolume, 10) : undefined;

  const [createGiftModalVisible, setCreateGiftModalVisible] = useState(false);
  const [giftTargetFriendCode, setGiftTargetFriendCode] = useState('');

  const [celebrateModalVisible, setCelebrateModalVisible] = useState(false);
  const [celebratedGift, setCelebratedGift] = useState<FriendGift | null>(null);
  const [selectedAthlete, setSelectedAthlete] = useState<LeaderboardEntry | null>(null);

  const handleOpenAuth = () => {
    const isAutoName =
      !profile?.username ||
      profile.username.startsWith('Athlète_') ||
      profile.username.startsWith('Dresseur_');
    setAuthMode('login');
    setAuthUsername(isAutoName ? '' : profile.username);
    setAuthModalVisible(true);
  };

  const handleOpenCreateGift = (targetCode?: string) => {
    setGiftTargetFriendCode(targetCode || friendsList[0]?.friendCode || '');
    setCreateGiftModalVisible(true);
  };

  const onClaimGiftAndCelebrate = async (gift: FriendGift) => {
    setCelebratedGift(gift);
    setCelebrateModalVisible(true);
    await handleClaimGift(gift);
  };

  return (
    <View style={styles.container}>
      {/* 1. En-tête profil et sélecteur d'onglets */}
      <ArenaHeader
        profile={profile}
        leagueName={leaderboardData?.league.name}
        isLoggedIn={isLoggedIn}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onShareFriendCode={handleShareFriendCode}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* 2. Contenu scrollable de l'onglet actif */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {activeTab === 'leaderboard' && (
          loading && !leaderboardData ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ marginTop: 14, color: Colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                Chargement des ligues et des athlètes...
              </Text>
            </View>
          ) : leaderboardData ? (
            <LeaderboardTab
              leaderboardData={leaderboardData}
              leaderboardFilter={leaderboardFilter}
              onFilterChange={setLeaderboardFilter}
              pendingRequests={pendingRequests}
              friendGifts={friendGifts}
              friendsList={friendsList}
              profile={profile}
              onAcceptRequest={handleAcceptRequest}
              onDeclineRequest={handleDeclineRequest}
              onShareWebInvite={handleShareWebInvite}
              onShareFriendCode={handleShareFriendCode}
              onOpenAddFriend={() => setAddFriendModalVisible(true)}
              onOpenManageFriends={() => setManageFriendsModalVisible(true)}
              onOpenCreateGift={() => handleOpenCreateGift()}
              onSimulateGift={handleSimulateGift}
              onClaimGift={onClaimGiftAndCelebrate}
              onRemoveFriend={handleRemoveFriend}
              onInviteAthlete={handleInviteAthlete}
              onSelectAthlete={setSelectedAthlete}
            />
          ) : null
        )}

        {activeTab === 'raids' && (
          <RaidsTab
            raidsSubTab={raidsSubTab}
            onSubTabChange={setRaidsSubTab}
            friendChallenges={friendChallenges}
            raidBoss={raidBoss}
            onOpenCreateChallenge={() => {
              setManualChallengeModalOpen(true);
              setChallengeDismissed(false);
            }}
            onTakeOnChallenge={handleTakeOnChallenge}
            onClaimReward={handleClaimReward}
            onStartRaidWorkout={handleStartRaidWorkout}
          />
        )}
      </ScrollView>

      {/* 3. Modales */}
      <AddFriendModal
        visible={addFriendModalVisible}
        onClose={() => setAddFriendModalVisible(false)}
        onAddFriend={handleAddFriend}
        onSimulateInvite={handleSimulateInvite}
      />

      <ManageFriendsModal
        visible={manageFriendsModalVisible}
        friendsList={friendsList}
        friendCode={profile?.friendCode}
        onClose={() => setManageFriendsModalVisible(false)}
        onOpenAddFriend={() => setAddFriendModalVisible(true)}
        onOpenCreateGift={handleOpenCreateGift}
        onRemoveFriend={handleRemoveFriend}
      />

      <TrainerAuthModal
        visible={authModalVisible}
        initialMode={authMode}
        initialUsername={authUsername}
        onClose={() => setAuthModalVisible(false)}
        onSubmit={handleAuthSubmit}
      />

      <CreateChallengeModal
        visible={createChallengeModalVisible}
        allExercises={allExercises}
        allPrograms={allPrograms}
        friendsList={friendsList}
        initialType={initialChallengeType}
        initialExerciseId={initialExerciseId}
        initialProgramId={initialProgramId}
        initialWeight={initialWeight}
        initialReps={initialReps}
        initialVolume={initialVolume}
        onClose={() => {
          setManualChallengeModalOpen(false);
          setChallengeDismissed(true);
        }}
        onSubmit={handleCreateChallenge}
      />

      <CreateGiftModal
        visible={createGiftModalVisible}
        friendsList={friendsList}
        initialTargetFriendCode={giftTargetFriendCode}
        onClose={() => setCreateGiftModalVisible(false)}
        onSubmit={handleCreateGift}
      />

      <CelebrateGiftModal
        visible={celebrateModalVisible}
        celebratedGift={celebratedGift}
        onClose={() => {
          setCelebrateModalVisible(false);
          setCelebratedGift(null);
        }}
      />

      <AthleteProfileModal
        visible={!!selectedAthlete}
        athlete={selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        onInviteAthlete={handleInviteAthlete}
        isAlreadyFriend={
          selectedAthlete
            ? friendsList.some(
                (f) =>
                  f.friendId === selectedAthlete.userId ||
                  (selectedAthlete.friendCode && f.friendCode === selectedAthlete.friendCode)
              )
            : false
        }
      />
    </View>
  );
}
