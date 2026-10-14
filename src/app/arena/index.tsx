import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Switch,
  Share,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  TrainerProfile,
  LeaderboardEntry,
  LeagueConfig,
  PokemonTradeOffer,
  CoOpRaidBoss,
  FriendEntry,
} from '../../types/social';
import { PokemonEgg } from '../../types';
import {
  getOrCreateTrainerProfile,
  getLeagueLeaderboard,
  getTradablePokemon,
  getCommunityTradeOffers,
  createTradeOffer,
  executePokemonTrade,
  getActiveCoOpRaidBoss,
  claimRaidVictoryReward,
  addFriendByCode,
  removeFriend,
  getFriendsList,
} from '../../services/multiplayerService';
import {
  registerTrainer,
  loginTrainer,
  getPersistedSession,
  logoutTrainer,
} from '../../services/authService';

const APK_DOWNLOAD_URL =
  'https://expo.dev/artifacts/eas/06idgnR7W-kUUaqdLC_8CLekX2jVI1aYRSOOj-nKw1c.apk';

type ArenaTab = 'leaderboard' | 'trades' | 'raids';
type LeaderboardFilter = 'global' | 'friends';
type TradeFilter = 'all' | 'friends';

export default function ArenaScreen() {
  const [activeTab, setActiveTab] = useState<ArenaTab>('leaderboard');
  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>('global');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');

  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [friendsList, setFriendsList] = useState<FriendEntry[]>([]);
  const [manageFriendsModalVisible, setManageFriendsModalVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{
    league: LeagueConfig;
    entries: LeaderboardEntry[];
    currentUserRank: number;
    timeRemainingText: string;
    totalParticipants: number;
  } | null>(null);
  const [tradablePokemon, setTradablePokemon] = useState<PokemonEgg[]>([]);
  const [tradeOffers, setTradeOffers] = useState<PokemonTradeOffer[]>([]);
  const [raidBoss, setRaidBoss] = useState<CoOpRaidBoss | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal d'offre d'échange
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedMyPokemonId, setSelectedMyPokemonId] = useState<string>('');
  const [tradeCriteriaInput, setTradeCriteriaInput] = useState('');
  const [tradeFriendsOnly, setTradeFriendsOnly] = useState(false);

  // Modal d'acceptation d'échange
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [selectedOfferToAccept, setSelectedOfferToAccept] = useState<PokemonTradeOffer | null>(null);

  // Modal d'ajout d'ami
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);

  // Modal Compte Dresseur (Pseudo + Mot de passe)
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const session = await getPersistedSession();
      setIsLoggedIn(Boolean(session?.isLoggedIn));

      const prof = await getOrCreateTrainerProfile();
      setProfile(prof);

      const lb = await getLeagueLeaderboard(leaderboardFilter);
      setLeaderboardData(lb);

      const tradables = await getTradablePokemon();
      setTradablePokemon(tradables);

      const friends = await getFriendsList();
      setFriendsList(friends);

      const offers = await getCommunityTradeOffers(tradeFilter);
      setTradeOffers(offers);

      const raid = await getActiveCoOpRaidBoss();
      setRaidBoss(raid);
    } catch (err) {
      console.error('Erreur chargement arène:', err);
    }
  }, [leaderboardFilter, tradeFilter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    Alert.alert(
      'Retirer un ami',
      `Voulez-vous retirer ${friendName} de votre cercle d’amis ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await removeFriend(friendId);
            await loadData();
            Alert.alert('Ami retiré', `${friendName} a été retiré de votre liste.`);
          },
        },
      ]
    );
  };

  const handleShareFriendCode = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: 'Rejoins mon arène sur Vitax !',
        message: `🔥 Rejoins-moi sur Vitax pour suivre nos entraînements et comparer nos classements !\n\n📲 Télécharge l'APK directement ici :\n${APK_DOWNLOAD_URL}\n\n🏆 Mon Code Ami : ${profile.friendCode}\n\nÀ tout de suite dans l'arène ! ⚔️`,
      });
    } catch {
      // Ignorer
    }
  };

  const handleShareApkInvite = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: 'Invitation à installer Vitax (APK direct)',
        message: `🏋️‍♂️ Salut ! Je t'invite à installer Vitax, notre application de musculation & défis sportifs.\n\n📲 Télécharge l'APK ici :\n${APK_DOWNLOAD_URL}\n\n🏆 Dès l'installation, ajoute mon Code Ami pour qu'on partage nos classements et s'échange des Pokémon : ${profile.friendCode}\n\nÀ très vite dans l'arène ! ⚔️`,
      });
    } catch {
      // Ignorer
    }
  };

  const handleAddFriend = async () => {
    if (!friendCodeInput.trim()) {
      Alert.alert('Code requis', 'Veuillez saisir le Code Ami du dresseur (ex: VTX-5120).');
      return;
    }
    setAddFriendLoading(true);
    const res = await addFriendByCode(friendCodeInput);
    setAddFriendLoading(false);

    if (res.success && res.friend) {
      setAddFriendModalVisible(false);
      setFriendCodeInput('');
      await loadData();
      Alert.alert(
        'Nouvel ami ajouté ! 🎉',
        `${res.friend.username} (${res.friend.friendCode}) a été ajouté à votre cercle d’amis !`
      );
    } else {
      Alert.alert('Erreur', res.error || 'Impossible d’ajouter cet ami.');
    }
  };

  const handleAuthSubmit = async () => {
    if (!authUsername.trim() || !authPassword) {
      Alert.alert('Champs requis', 'Veuillez saisir votre nom d’utilisateur et votre mot de passe.');
      return;
    }
    setAuthLoading(true);
    if (authMode === 'register') {
      const res = await registerTrainer(authUsername, authPassword);
      setAuthLoading(false);
      if (res.success) {
        setAuthModalVisible(false);
        setAuthPassword('');
        await loadData();
        Alert.alert(
          'Compte Dresseur créé ! 🏆',
          `Bienvenue ${authUsername} ! Vos scores et Pokémon sont désormais sauvegardés en permanence sur le réseau partagé.`
        );
      } else {
        Alert.alert('Erreur', res.error || 'Impossible de créer le compte.');
      }
    } else {
      const res = await loginTrainer(authUsername, authPassword);
      setAuthLoading(false);
      if (res.success) {
        setAuthModalVisible(false);
        setAuthPassword('');
        await loadData();
        Alert.alert(
          'Rebonjour ! ⚡',
          `Ravi de vous revoir ${authUsername}. Vos statistiques d’entraînement ont été synchronisées.`
        );
      } else {
        Alert.alert('Erreur de connexion', res.error || 'Identifiants incorrects.');
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter de votre compte Dresseur ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logoutTrainer();
            await loadData();
            Alert.alert('Déconnecté', 'Vous êtes repassé en mode local.');
          },
        },
      ]
    );
  };

  const handleCreateOffer = async () => {
    if (!selectedMyPokemonId) {
      Alert.alert('Sélection requise', 'Veuillez choisir un Pokémon de votre collection à proposer.');
      return;
    }
    try {
      await createTradeOffer({
        pokemonEggId: selectedMyPokemonId,
        requestedCriteriaText: tradeCriteriaInput.trim() || 'Ouvert à toute proposition équivalente',
        friendsOnly: tradeFriendsOnly,
      });
      setCreateModalVisible(false);
      setSelectedMyPokemonId('');
      setTradeCriteriaInput('');
      setTradeFriendsOnly(false);
      await loadData();
      Alert.alert(
        'Offre publiée ! 📢',
        tradeFriendsOnly
          ? 'Votre offre est désormais visible exclusivement par votre cercle d’amis ! 👥'
          : 'Votre Pokémon est désormais disponible à l’échange dans l’Arène générale ! 🌍'
      );
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de créer l’offre.');
    }
  };

  const handleConfirmTrade = async () => {
    if (!selectedOfferToAccept || !selectedMyPokemonId) {
      Alert.alert('Sélection requise', 'Veuillez choisir le Pokémon que vous offrez en contrepartie.');
      return;
    }
    try {
      const result = await executePokemonTrade(selectedOfferToAccept.id, selectedMyPokemonId);
      setAcceptModalVisible(false);
      setSelectedOfferToAccept(null);
      setSelectedMyPokemonId('');
      await loadData();
      Alert.alert(
        'Félicitations ! 🎉',
        `L’échange a été validé ! Vous avez obtenu : ${result.receivedPokemonName} ! Il a été ajouté à votre Pokédex.`
      );
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Échec de l’échange.');
    }
  };

  const handleClaimReward = async () => {
    try {
      const egg = await claimRaidVictoryReward();
      await loadData();
      Alert.alert(
        'Victoire de Raid ! 🏆',
        `Vous avez récupéré votre récompense de Raid : ${egg.pokemon_name || 'Œuf Légendaire'} ! Placez-le en incubation.`
      );
    } catch (e: any) {
      Alert.alert('Info', e.message || 'Récompense non disponible.');
    }
  };

  return (
    <View style={styles.container}>
      {/* En-tête Dresseur Profil & Code Ami */}
      {profile && (
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.profileAvatarBox}
            onPress={() => {
              setAuthUsername(profile.username);
              setAuthModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.profileAvatarEmoji}>{profile.avatarPokemonEmoji}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileUsername}>{profile.username}</Text>
              <TouchableOpacity
                style={styles.friendCodeBadge}
                onPress={handleShareFriendCode}
                activeOpacity={0.7}
              >
                <Text style={styles.friendCodeText}>{profile.friendCode} 📤</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.profileTitleText}>
              {profile.trainerTitle} • {leaderboardData?.league.name}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.accountStatusBtn}
            onPress={() => {
              if (isLoggedIn) {
                handleLogout();
              } else {
                setAuthMode('register');
                setAuthUsername(profile.username);
                setAuthModalVisible(true);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.accountStatusBtnText}>
              {isLoggedIn ? '🟢 Compte actif' : '⚡ Créer compte'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sélecteur d'onglets de l'Arène */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leaderboard' && styles.tabButtonActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'leaderboard' && styles.tabButtonTextActive]}>
            🏆 Ligues & XP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'trades' && styles.tabButtonActive]}
          onPress={() => setActiveTab('trades')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'trades' && styles.tabButtonTextActive]}>
            🔄 Échanges
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'raids' && styles.tabButtonActive]}
          onPress={() => setActiveTab('raids')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'raids' && styles.tabButtonTextActive]}>
            ⚔️ Raids Co-op
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ======================================================== */}
        {/* ONGLET 1 : LIGUES & CLASSEMENTS HEBDOMADAIRES             */}
        {/* ======================================================== */}
        {activeTab === 'leaderboard' && leaderboardData && (
          <View>
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

            {/* MODULE D'INVITATION À INSTALLER L'APPLICATION AVEC LIEN APK */}
            <Card style={styles.inviteApkCard}>
              <View style={styles.inviteApkTopRow}>
                <View style={styles.inviteApkIconBox}>
                  <Text style={{ fontSize: 22 }}>📲</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.inviteApkBadgeRow}>
                    <Text style={styles.inviteApkTitle}>Inviter des amis sur Vitax</Text>
                    <Badge label="Lien APK direct" color="rgba(0, 229, 255, 0.2)" textColor="#00E5FF" />
                  </View>
                  <Text style={styles.inviteApkSub}>
                    Partagez l’application à vos partenaires de sport pour qu’ils installent l’APK et vous défient dans votre cercle d’amis.
                  </Text>
                </View>
              </View>

              <View style={styles.inviteApkLinkBox}>
                <Text style={styles.inviteApkUrlText} numberOfLines={1}>
                  {APK_DOWNLOAD_URL}
                </Text>
              </View>

              <View style={styles.inviteApkButtonsRow}>
                <TouchableOpacity
                  style={styles.inviteApkShareBtn}
                  onPress={handleShareApkInvite}
                  activeOpacity={0.8}
                >
                  <Text style={styles.inviteApkShareBtnText}>
                    📤 Envoyer l’invitation (Lien APK + Code Ami)
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
                onPress={() => setLeaderboardFilter('global')}
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
                onPress={() => setLeaderboardFilter('friends')}
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
                    onPress={handleShareFriendCode}
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
                    onPress={() => setAddFriendModalVisible(true)}
                    style={{ flex: 1 }}
                  />
                  {friendsList.length > 0 && (
                    <Button
                      title={`Gérer (${friendsList.length})`}
                      variant="outline"
                      size="sm"
                      onPress={() => setManageFriendsModalVisible(true)}
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
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
                  onPress={() => setAddFriendModalVisible(true)}
                  style={{ marginTop: 12, alignSelf: 'center' }}
                />
              </Card>
            ) : (
              leaderboardData.entries.map((entry) => {
                const isPromoted =
                  leaderboardFilter === 'global' &&
                  entry.rank <= leaderboardData.league.promotionSpots;
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

                    <View style={styles.entryAvatar}>
                      <Text style={{ fontSize: 20 }}>{entry.avatarPokemonEmoji}</Text>
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
                      <Text style={styles.xpValue}>{entry.weeklyXp} XP</Text>
                      {isPromoted && <Text style={styles.promotedBadge}>▲ Promu</Text>}
                    </View>

                    {leaderboardFilter === 'friends' && !entry.isCurrentUser && (
                      <TouchableOpacity
                        style={styles.deleteFriendBtn}
                        onPress={() => handleRemoveFriend(entry.userId, entry.username)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* ONGLET 2 : CENTRE D'ÉCHANGE POKÉMON                      */}
        {/* ======================================================== */}
        {activeTab === 'trades' && (
          <View>
            <View style={styles.tradeHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeaderTitle}>Centre d’Échange Pokémon 🔄</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Échangez vos Pokémon débloqués avec d’autres dresseurs
                </Text>
              </View>
              <TouchableOpacity
                style={styles.newTradeBtn}
                onPress={() => setCreateModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.newTradeBtnText}>+ Proposer</Text>
              </TouchableOpacity>
            </View>

            {/* FILTRE : TOUTES LES OFFRES VS OFFRES D'AMIS */}
            <View style={[styles.filterSegmentContainer, { marginBottom: 14 }]}>
              <TouchableOpacity
                style={[
                  styles.filterSegmentBtn,
                  tradeFilter === 'all' && styles.filterSegmentBtnActive,
                ]}
                onPress={() => setTradeFilter('all')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterSegmentText,
                    tradeFilter === 'all' && styles.filterSegmentTextActive,
                  ]}
                >
                  🌍 Toutes les offres
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterSegmentBtn,
                  tradeFilter === 'friends' && styles.filterSegmentBtnActive,
                ]}
                onPress={() => setTradeFilter('friends')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterSegmentText,
                    tradeFilter === 'friends' && styles.filterSegmentTextActive,
                  ]}
                >
                  👥 Offres d’amis
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mes Pokémon Échangeables */}
            <Card style={styles.myTradablesCard}>
              <Text style={styles.myTradablesTitle}>
                Vos Pokémon Disponibles ({tradablePokemon.length})
              </Text>
              {tradablePokemon.length === 0 ? (
                <Text style={styles.emptyNote}>
                  Faites éclore des œufs d’entraînement pour obtenir des Pokémon échangeables.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingTop: 8 }}
                >
                  {tradablePokemon.map((p) => (
                    <View key={p.id} style={styles.tradableChip}>
                      <Text style={{ fontSize: 22 }}>{p.pokemon_emoji || '🥚'}</Text>
                      <Text style={styles.tradableName} numberOfLines={1}>
                        {p.pokemon_name}
                      </Text>
                      <Text style={styles.tradableCp}>CP {p.pokemon_cp || 400}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </Card>

            {/* Offres disponibles */}
            <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>
              {tradeFilter === 'friends'
                ? `Offres de votre cercle d’amis (${tradeOffers.length})`
                : `Toutes les offres de l’Arène (${tradeOffers.length})`}
            </Text>

            {tradeOffers.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={{ fontSize: 30, textAlign: 'center', marginBottom: 6 }}>🔄</Text>
                <Text style={styles.emptyCardTitle}>Aucune offre disponible</Text>
                <Text style={styles.emptyCardSub}>
                  {tradeFilter === 'friends'
                    ? 'Aucun de vos amis n’a publié d’offre pour le moment. Proposez-leur un échange !'
                    : 'Soyez le premier à proposer un Pokémon à l’échange !'}
                </Text>
              </Card>
            ) : (
              tradeOffers.map((offer) => {
                const isCompleted = offer.status === 'completed';
                return (
                  <Card
                    key={offer.id}
                    style={[styles.offerCard, isCompleted && styles.offerCardCompleted]}
                  >
                    <View style={styles.offerTopRow}>
                      <View style={styles.offerPokemonBox}>
                        <Text style={{ fontSize: 32 }}>{offer.offeredPokemon.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Text style={styles.offerPokemonName}>{offer.offeredPokemon.name}</Text>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {offer.friendsOnly && (
                              <Badge
                                label="👥 Amis"
                                color="rgba(245, 158, 11, 0.15)"
                                textColor="#FBBF24"
                              />
                            )}
                            <Badge
                              label={`CP ${offer.offeredPokemon.cp}`}
                              color="rgba(59, 130, 246, 0.15)"
                              textColor="#60A5FA"
                            />
                          </View>
                        </View>
                        <Text style={styles.offerType}>Type : {offer.offeredPokemon.type}</Text>
                        <Text style={styles.offerTrainer}>
                          Proposé par{' '}
                          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                            {offer.senderName} ({offer.senderCode})
                          </Text>
                        </Text>
                      </View>
                    </View>

                    {offer.requestedCriteriaText && (
                      <View style={styles.criteriaBox}>
                        <Text style={styles.criteriaText}>
                          💡 Souhait : {offer.requestedCriteriaText}
                        </Text>
                      </View>
                    )}

                    <View style={styles.offerBottomRow}>
                      {isCompleted ? (
                        <Text style={styles.completedBadgeText}>✓ Échange conclu</Text>
                      ) : (
                        <Button
                          title="Échanger avec ce Pokémon 🤝"
                          size="sm"
                          variant="primary"
                          onPress={() => {
                            setSelectedOfferToAccept(offer);
                            setAcceptModalVisible(true);
                          }}
                        />
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* ONGLET 3 : RAIDS CO-OP & DÉFIS COLLECTIFS                */}
        {/* ======================================================== */}
        {activeTab === 'raids' && raidBoss && (
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
                      title="🎁 Réclamer mon Œuf Légendaire"
                      variant="primary"
                      size="md"
                      onPress={handleClaimReward}
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
                  title="🏋️ Participer (Faire une séance) ▶"
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/(tabs)')}
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
                <Text style={{ fontSize: 20, marginRight: 10 }}>{p.avatarPokemonEmoji}</Text>
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
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1 : AJOUTER UN AMI PAR CODE                        */}
      {/* ======================================================== */}
      <Modal
        visible={addFriendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddFriendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter un Ami 👥</Text>
            <Text style={styles.modalSub}>
              Saisissez le Code Ami fourni par votre partenaire d’entraînement (ex: VTX-5120 ou 5120) :
            </Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Code Ami (ex: VTX-7429)"
              placeholderTextColor={Colors.textMuted}
              value={friendCodeInput}
              onChangeText={setFriendCodeInput}
              autoCapitalize="characters"
              maxLength={8}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setAddFriendModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={addFriendLoading ? 'Vérification...' : 'Ajouter l’ami'}
                variant="primary"
                size="md"
                onPress={handleAddFriend}
                disabled={addFriendLoading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL GESTION DES AMIS (CONSULTATION & SUPPRESSION)      */}
      {/* ======================================================== */}
      <Modal
        visible={manageFriendsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManageFriendsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.modalTitle}>Mes Amis ({friendsList.length})</Text>
              <TouchableOpacity
                onPress={() => {
                  setManageFriendsModalVisible(false);
                  setAddFriendModalVisible(true);
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
                  Aucun ami dans votre cercle. Partagez votre Code Ami ({profile?.friendCode}) pour commencer !
                </Text>
              ) : (
                friendsList.map((f) => (
                  <View key={f.friendId} style={styles.friendManageRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 24 }}>{f.avatarPokemonEmoji || '⚡'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendManageName}>{f.username}</Text>
                        <Text style={styles.friendManageCode}>{f.friendCode} • {f.trainerTitle}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.friendDeleteBtn}
                      onPress={() => handleRemoveFriend(f.friendId, f.username)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.friendDeleteBtnText}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <Button
              title="Fermer"
              variant="outline"
              size="md"
              onPress={() => setManageFriendsModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2 : COMPTE DRESSEUR (PSEUDO + MOT DE PASSE)        */}
      {/* ======================================================== */}
      <Modal
        visible={authModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAuthModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={styles.authModalIcon}>
                <Text style={{ fontSize: 32 }}>🏆</Text>
              </View>
              <Text style={styles.modalTitle}>
                {authMode === 'register' ? 'Créer mon Compte Dresseur' : 'Connexion Dresseur'}
              </Text>
              <Text style={styles.modalSub}>
                {authMode === 'register'
                  ? 'Rejoignez le classement partagé et conservez vos Pokémon sur tous vos appareils.'
                  : 'Retrouvez votre compte, vos Pokémon et votre place dans la ligue.'}
              </Text>
            </View>

            <View style={{ marginBottom: 10 }}>
              <Text style={styles.inputLabel}>Nom d’utilisateur (Pseudo)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Ex: Alexandre, Sarah, Thomas..."
                placeholderTextColor={Colors.textMuted}
                value={authUsername}
                onChangeText={setAuthUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginBottom: 14 }}>
              <Text style={styles.inputLabel}>Mot de passe</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
              />
            </View>

            <View style={styles.authPersistentHint}>
              <Text style={styles.authPersistentHintText}>
                🔒 Connexion permanente : vous n’aurez jamais besoin de resaisir votre mot de passe à l’ouverture de l’application.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button
                title="Fermer"
                variant="outline"
                size="md"
                onPress={() => setAuthModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  authLoading
                    ? 'Chargement...'
                    : authMode === 'register'
                    ? 'Créer le compte 🚀'
                    : 'Se connecter ⚡'
                }
                variant="primary"
                size="md"
                onPress={handleAuthSubmit}
                disabled={authLoading}
                style={{ flex: 1.3 }}
              />
            </View>

            <TouchableOpacity
              style={styles.authToggleModeBtn}
              onPress={() => setAuthMode((m) => (m === 'register' ? 'login' : 'register'))}
            >
              <Text style={styles.authToggleModeText}>
                {authMode === 'register'
                  ? 'Vous avez déjà un compte ? Connectez-vous'
                  : 'Nouveau dresseur ? Créez un compte'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3 : PROPOSER UN POKÉMON À L’ÉCHANGE                */}
      {/* ======================================================== */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Proposer un Pokémon à l’Échange</Text>
            <Text style={styles.modalSub}>Choisissez parmi vos Pokémon éclos :</Text>

            <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
              {tradablePokemon.map((item) => {
                const isSelected = selectedMyPokemonId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modalSelectItem, isSelected && styles.modalSelectItemActive]}
                    onPress={() => setSelectedMyPokemonId(item.id)}
                  >
                    <Text style={{ fontSize: 26, marginRight: 10 }}>{item.pokemon_emoji || '🥚'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{item.pokemon_name}</Text>
                      <Text style={styles.modalItemSub}>
                        Type: {item.pokemon_type} • CP {item.pokemon_cp || 400}
                      </Text>
                    </View>
                    {isSelected && <Text style={{ color: Colors.primary, fontWeight: '900' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { marginTop: 4 }]}>Critère ou souhait (optionnel)</Text>
            <TextInput
              style={[styles.modalTextInput, { marginBottom: 10 }]}
              placeholder="Ex: Recherche Salamèche, Carapuce ou type Combat"
              placeholderTextColor={Colors.textMuted}
              value={tradeCriteriaInput}
              onChangeText={setTradeCriteriaInput}
            />

            {/* SWITCH : RÉSERVÉ AUX AMIS */}
            <View style={styles.friendsOnlySwitchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.friendsOnlySwitchTitle}>🔒 Réservé à mes amis uniquement</Text>
                <Text style={styles.friendsOnlySwitchSub}>
                  L’offre ne sera visible et échangeable que par vos amis ajoutés
                </Text>
              </View>
              <Switch
                value={tradeFriendsOnly}
                onValueChange={setTradeFriendsOnly}
                trackColor={{ false: '#263449', true: Colors.primary }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setCreateModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Publier l’offre"
                variant="primary"
                size="md"
                onPress={handleCreateOffer}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4 : CONFIRMATION D'ACCEPTATION D'UN ÉCHANGE        */}
      {/* ======================================================== */}
      <Modal
        visible={acceptModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAcceptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Conclure l’Échange 🤝</Text>
            <Text style={styles.modalSub}>
              Vous allez recevoir :{' '}
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                {selectedOfferToAccept?.offeredPokemon.name}{' '}
                {selectedOfferToAccept?.offeredPokemon.emoji}
              </Text>
            </Text>
            <Text style={[styles.modalSub, { marginTop: 8 }]}>
              Sélectionnez le Pokémon que vous donnez en retour :
            </Text>

            <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
              {tradablePokemon.map((item) => {
                const isSelected = selectedMyPokemonId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modalSelectItem, isSelected && styles.modalSelectItemActive]}
                    onPress={() => setSelectedMyPokemonId(item.id)}
                  >
                    <Text style={{ fontSize: 26, marginRight: 10 }}>{item.pokemon_emoji || '🥚'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{item.pokemon_name}</Text>
                      <Text style={styles.modalItemSub}>
                        CP {item.pokemon_cp || 400} • {item.pokemon_type}
                      </Text>
                    </View>
                    {isSelected && <Text style={{ color: Colors.primary, fontWeight: '900' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setAcceptModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirmer l’échange"
                variant="primary"
                size="md"
                onPress={handleConfirmTrade}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C42',
    gap: 12,
  },
  profileAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  profileAvatarEmoji: {
    fontSize: 26,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  profileUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  friendCodeBadge: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
  },
  friendCodeText: {
    color: '#FF7A45',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileTitleText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  accountStatusBtn: {
    backgroundColor: '#1E2C42',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F4363',
  },
  accountStatusBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#0D1321',
    borderBottomWidth: 1,
    borderBottomColor: '#1A2538',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#1E2C44',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabButtonText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  leagueBannerCard: {
    backgroundColor: '#121A28',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  leagueBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leagueIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  leagueBannerSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  leagueTimeBadge: {
    backgroundColor: '#1C2638',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  leagueTimeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  myRankCard: {
    backgroundColor: '#152033',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#243450',
    alignItems: 'center',
  },
  myRankLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  myRankValue: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 2,
  },
  myRankHint: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  filterSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  filterSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterSegmentBtnActive: {
    backgroundColor: '#263449',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  filterSegmentText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  friendsActionCard: {
    backgroundColor: '#141E2F',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3C59',
  },
  friendsActionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  friendsActionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  friendsActionCode: {
    color: '#FF7A45',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  friendsShareBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.5)',
  },
  friendsShareBtnText: {
    color: '#FF7A45',
    fontSize: 12,
    fontWeight: '800',
  },
  friendsActionBottom: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F293D',
    marginVertical: 10,
  },
  emptyCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCardSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111726',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1C263A',
  },
  leaderboardRowCurrent: {
    backgroundColor: '#1C2337',
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  rank1: { fontSize: 18 },
  rank2: { fontSize: 18 },
  rank3: { fontSize: 18 },
  entryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  entryNameCurrent: {
    color: '#FF7A45',
    fontWeight: '900',
  },
  youBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  entrySub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  xpCol: {
    alignItems: 'flex-end',
  },
  xpValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  promotedBadge: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  tradeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newTradeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  newTradeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  myTradablesCard: {
    backgroundColor: '#131C2D',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  myTradablesTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyNote: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  tradableChip: {
    backgroundColor: '#1B263C',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#26344E',
  },
  tradableName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tradableCp: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  offerCard: {
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1D283D',
  },
  offerCardCompleted: {
    opacity: 0.6,
  },
  offerTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  offerPokemonBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A2538',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerPokemonName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  offerType: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  offerTrainer: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  criteriaBox: {
    backgroundColor: '#162033',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  criteriaText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  offerBottomRow: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  completedBadgeText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  raidBossCard: {
    backgroundColor: '#151C2C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
  },
  raidHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  raidBossBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  raidBossBadgeText: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  raidTypeTag: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  bossCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  bossAvatarBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  bossDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  gaugeContainer: {
    backgroundColor: '#0F1626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gaugeLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  gaugeNumbers: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  gaugeTrack: {
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 5,
  },
  gaugePercent: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  victoryBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
    alignItems: 'center',
    marginTop: 10,
  },
  victoryTitle: {
    color: Colors.success,
    fontSize: 15,
    fontWeight: '900',
  },
  victorySub: {
    color: '#D1FAE5',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  claimedNotice: {
    color: Colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111726',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  participantRowCurrent: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  participantRank: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    width: 28,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  participantVal: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#151E2E',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#263449',
  },
  authModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#0F1626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#25354D',
  },
  authPersistentHint: {
    backgroundColor: '#111A29',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1D2B40',
  },
  authPersistentHintText: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 16,
  },
  authToggleModeBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  authToggleModeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1626',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#212D40',
  },
  modalSelectItemActive: {
    borderColor: Colors.primary,
    backgroundColor: '#1A2338',
  },
  modalItemName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalItemSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  friendsOnlySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101726',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1F2C40',
  },
  friendsOnlySwitchTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  friendsOnlySwitchSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  deleteFriendBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendMiniBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addFriendMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  friendManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1626',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  friendManageName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  friendManageCode: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  friendDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  friendDeleteBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  inviteApkCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#00E5FF44',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  inviteApkTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteApkIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#00E5FF18',
    borderWidth: 1,
    borderColor: '#00E5FF44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteApkBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inviteApkTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inviteApkSub: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  inviteApkLinkBox: {
    backgroundColor: '#090E1A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inviteApkUrlText: {
    color: '#00E5FF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inviteApkButtonsRow: {
    marginTop: 10,
  },
  inviteApkShareBtn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteApkShareBtnText: {
    color: '#090E1A',
    fontSize: 13,
    fontWeight: '900',
  },
});
