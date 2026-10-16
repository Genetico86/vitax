import React, { useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Colors } from '../../constants/colors';
import { PokemonTradeOffer, FriendGift } from '../../types/social';
import { useArenaData } from '../../components/arena/hooks/useArenaData';
import { arenaStyles as styles } from '../../components/arena/styles/arenaStyles';
import { ArenaHeader } from '../../components/arena/ArenaHeader';
import { LeaderboardTab } from '../../components/arena/tabs/LeaderboardTab';
import { TradesTab } from '../../components/arena/tabs/TradesTab';
import { RaidsTab } from '../../components/arena/tabs/RaidsTab';
import { AddFriendModal } from '../../components/arena/modals/AddFriendModal';
import { ManageFriendsModal } from '../../components/arena/modals/ManageFriendsModal';
import { TrainerAuthModal } from '../../components/arena/modals/TrainerAuthModal';
import { CreateTradeModal } from '../../components/arena/modals/CreateTradeModal';
import { AcceptTradeModal } from '../../components/arena/modals/AcceptTradeModal';
import { CreateChallengeModal } from '../../components/arena/modals/CreateChallengeModal';
import { CreateGiftModal } from '../../components/arena/modals/CreateGiftModal';
import { CelebrateGiftModal } from '../../components/arena/modals/CelebrateGiftModal';

export default function ArenaScreen() {
  const {
    activeTab,
    setActiveTab,
    leaderboardFilter,
    setLeaderboardFilter,
    tradeFilter,
    setTradeFilter,
    raidsSubTab,
    setRaidsSubTab,
    profile,
    isLoggedIn,
    friendsList,
    leaderboardData,
    tradablePokemon,
    tradeOffers,
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
    handleAcceptRequest,
    handleDeclineRequest,
    handleSimulateInvite,
    handleCreateGift,
    handleClaimGift,
    handleSimulateGift,
    handleAuthSubmit,
    handleLogout,
    handleCreateOffer,
    handleConfirmTrade,
    handleClaimReward,
    handleCreateChallenge,
    handleTakeOnChallenge,
    handleStartRaidWorkout,
  } = useArenaData();

  // Modales d'interaction
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [manageFriendsModalVisible, setManageFriendsModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('login');
  const [authUsername, setAuthUsername] = useState('');

  const [createTradeModalVisible, setCreateTradeModalVisible] = useState(false);
  const [acceptTradeModalVisible, setAcceptTradeModalVisible] = useState(false);
  const [selectedOfferToAccept, setSelectedOfferToAccept] = useState<PokemonTradeOffer | null>(null);

  const [createChallengeModalVisible, setCreateChallengeModalVisible] = useState(false);
  const [createGiftModalVisible, setCreateGiftModalVisible] = useState(false);
  const [giftTargetFriendCode, setGiftTargetFriendCode] = useState('');

  const [celebrateModalVisible, setCelebrateModalVisible] = useState(false);
  const [celebratedGift, setCelebratedGift] = useState<FriendGift | null>(null);

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
        {activeTab === 'leaderboard' && leaderboardData && (
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
          />
        )}

        {activeTab === 'trades' && (
          <TradesTab
            tradablePokemon={tradablePokemon}
            tradeOffers={tradeOffers}
            tradeFilter={tradeFilter}
            onFilterChange={setTradeFilter}
            onOpenCreateOffer={() => setCreateTradeModalVisible(true)}
            onAcceptOffer={(offer) => {
              setSelectedOfferToAccept(offer);
              setAcceptTradeModalVisible(true);
            }}
          />
        )}

        {activeTab === 'raids' && (
          <RaidsTab
            raidsSubTab={raidsSubTab}
            onSubTabChange={setRaidsSubTab}
            friendChallenges={friendChallenges}
            raidBoss={raidBoss}
            onOpenCreateChallenge={() => setCreateChallengeModalVisible(true)}
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

      <CreateTradeModal
        visible={createTradeModalVisible}
        tradablePokemon={tradablePokemon}
        onClose={() => setCreateTradeModalVisible(false)}
        onSubmit={handleCreateOffer}
      />

      <AcceptTradeModal
        visible={acceptTradeModalVisible}
        offer={selectedOfferToAccept}
        tradablePokemon={tradablePokemon}
        onClose={() => {
          setAcceptTradeModalVisible(false);
          setSelectedOfferToAccept(null);
        }}
        onSubmit={handleConfirmTrade}
      />

      <CreateChallengeModal
        visible={createChallengeModalVisible}
        allExercises={allExercises}
        allPrograms={allPrograms}
        friendsList={friendsList}
        onClose={() => setCreateChallengeModalVisible(false)}
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
    </View>
  );
}
