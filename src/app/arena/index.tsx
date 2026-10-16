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
  FriendChallenge,
  FriendRequest,
  FriendGift,
} from '../../types/social';
import {
  createFriendGift,
  getFriendGifts,
  claimFriendGift,
  simulateFriendGift,
} from '../../services/friendGiftService';
import { PokemonEgg, Exercise, Program } from '../../types';
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
  syncTrainerProfileToSupabase,
  getFriendChallenges,
  createFriendChallenge,
  getPendingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  simulateFriendRequest,
} from '../../services/multiplayerService';
import { getAllExercises } from '../../database/exerciseRepository';
import { getAllPrograms } from '../../database/programRepository';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import {
  registerTrainer,
  loginTrainer,
  getPersistedSession,
  logoutTrainer,
} from '../../services/authService';

const WEB_APP_URL = 'https://vitaxsport.vercel.app';

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
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Cadeaux de Motivation entre Amis
  const [friendGifts, setFriendGifts] = useState<{
    sent: FriendGift[];
    received: FriendGift[];
    unlockedUnclaimedCount: number;
  }>({ sent: [], received: [], unlockedUnclaimedCount: 0 });
  const [createGiftModalVisible, setCreateGiftModalVisible] = useState(false);
  const [giftTargetFriendCode, setGiftTargetFriendCode] = useState('');
  const [giftNameInput, setGiftNameInput] = useState('');
  const [giftTargetXpInput, setGiftTargetXpInput] = useState('300');
  const [giftPersonalMessageInput, setGiftPersonalMessageInput] = useState('');
  const [createGiftLoading, setCreateGiftLoading] = useState(false);
  const [celebratedGift, setCelebratedGift] = useState<FriendGift | null>(null);
  const [celebrateModalVisible, setCelebrateModalVisible] = useState(false);

  // Sous-onglet Raids & Défis
  const [raidsSubTab, setRaidsSubTab] = useState<'challenges' | 'boss'>('challenges');
  const [friendChallenges, setFriendChallenges] = useState<FriendChallenge[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);

  // Modal Créer un Défi
  const [createChallengeModalVisible, setCreateChallengeModalVisible] = useState(false);
  const [challengeType, setChallengeType] = useState<'exercise' | 'program'>('exercise');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetRepsInput, setTargetRepsInput] = useState('10');
  const [targetVolumeInput, setTargetVolumeInput] = useState('3000');
  const [challengeInstructionsInput, setChallengeInstructionsInput] = useState('');
  const [targetFriendCodeInput, setTargetFriendCodeInput] = useState('all');
  const [createChallengeLoading, setCreateChallengeLoading] = useState(false);

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

  const { startTargetedWorkout, startWorkoutFromProgram, startFreeWorkout } = useWorkoutSessionStore();

  const loadData = useCallback(async () => {
    try {
      const session = await getPersistedSession();
      setIsLoggedIn(Boolean(session?.isLoggedIn));

      const prof = await getOrCreateTrainerProfile();
      setProfile(prof);
      await syncTrainerProfileToSupabase(prof);

      const [lb, tradables, friends, offers, raid, chlgList, exList, progList, reqList, giftsData] = await Promise.all([
        getLeagueLeaderboard(leaderboardFilter),
        getTradablePokemon(),
        getFriendsList(),
        getCommunityTradeOffers(tradeFilter),
        getActiveCoOpRaidBoss(),
        getFriendChallenges(),
        getAllExercises(),
        getAllPrograms(),
        getPendingFriendRequests(),
        getFriendGifts(),
      ]);

      setLeaderboardData(lb);
      setTradablePokemon(tradables);
      setFriendsList(friends);
      setTradeOffers(offers);
      setRaidBoss(raid);
      setFriendChallenges(chlgList);
      setAllExercises(exList);
      setAllPrograms(progList);
      setPendingRequests(reqList);
      setFriendGifts(giftsData);

      if (friends.length > 0) {
        setGiftTargetFriendCode((prev) => prev || friends[0].friendCode);
      }

      if (exList.length > 0 && !selectedExerciseId) {
        setSelectedExerciseId(exList[0].id);
      }
      if (progList.length > 0 && !selectedProgramId) {
        setSelectedProgramId(progList[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement arène:', err);
    }
  }, [leaderboardFilter, tradeFilter, selectedExerciseId, selectedProgramId]);

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
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(profile.friendCode);
        Alert.alert('Code copié ! 📋', `Votre Code Ami (${profile.friendCode}) a été copié dans le presse-papier.`);
        return;
      }
      await Share.share({
        title: 'Rejoins mon arène sur Vitax !',
        message: `🔥 Rejoins-moi sur l’application Vitax pour suivre nos entraînements et comparer nos classements !\n\n🌐 Accède directement à l'application web ici (mobile ou PC) :\n${WEB_APP_URL}\n\n🏆 Mon Code Athlète : ${profile.friendCode}\n\nÀ tout de suite dans l'arène ! ⚔️`,
      });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(profile.friendCode);
          Alert.alert('Code copié ! 📋', `Votre Code Ami (${profile.friendCode}) a été copié dans le presse-papier.`);
        } catch {}
      }
    }
  };

  const handleShareWebInvite = async () => {
    if (!profile) return;
    const inviteMessage = `🏋️‍♂️ Salut ! Je t'invite à rejoindre Vitax, notre application de musculation & défis sportifs.\n\n🌐 Ouvre l'application web directement ici (sans rien installer) :\n${WEB_APP_URL}\n\n🏆 Dès ton arrivée, ajoute mon Code Athlète pour qu'on partage nos classements et s'échange nos Pokémon : ${profile.friendCode}\n\nÀ très vite dans l'arène ! ⚔️`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteMessage);
        Alert.alert('Invitation copiée ! 📋', 'Le message d’invitation avec votre Code Ami et le lien web a été copié.');
        return;
      }
      await Share.share({
        title: 'Invitation à rejoindre Vitax (App Web)',
        message: inviteMessage,
      });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(inviteMessage);
          Alert.alert('Invitation copiée ! 📋', 'Le message d’invitation avec votre Code Ami et le lien web a été copié.');
        } catch {}
      }
    }
  };

  const handleAddFriend = async () => {
    if (!friendCodeInput.trim()) {
      Alert.alert('Code requis', 'Veuillez saisir le Code Ami à 5 chiffres (ex: 48219) ou le pseudo.');
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

  const handleAcceptRequest = async (requestId: string) => {
    const res = await acceptFriendRequest(requestId);
    if (res.success && res.friend) {
      await loadData();
      Alert.alert('Ami accepté ! 🎉', `${res.friend.username} a été ajouté à votre cercle d’amis !`);
    } else {
      Alert.alert('Erreur', res.error || 'Impossible d’accepter cette demande.');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    await declineFriendRequest(requestId);
    await loadData();
    Alert.alert('Demande refusée', 'La demande d’ami a été retirée.');
  };

  const handleSimulateInvite = async () => {
    await simulateFriendRequest('Alexandre (Coach)', 'VTX-5491');
    await loadData();
    Alert.alert('Notification simulée ! 🔔', 'Une invitation d’ami vient d’être générée. La notification apparaît en haut de l’écran !');
  };

  const handleCreateGift = async () => {
    if (!giftNameInput.trim()) {
      Alert.alert('Nom du cadeau requis', 'Veuillez saisir ce que vous souhaitez offrir (ex: Shaker de Whey, Resto post-séance, Barres...).');
      return;
    }
    const targetXp = parseInt(giftTargetXpInput, 10);
    if (isNaN(targetXp) || targetXp < 50) {
      Alert.alert('Objectif d’XP invalide', 'Veuillez définir au moins 50 XP pour débloquer ce cadeau.');
      return;
    }
    const targetFriend = friendsList.find((f) => f.friendCode === giftTargetFriendCode);
    if (!targetFriend) {
      Alert.alert('Ami introuvable', 'Veuillez sélectionner un ami dans votre cercle.');
      return;
    }

    setCreateGiftLoading(true);
    try {
      await createFriendGift({
        receiverId: targetFriend.friendId,
        receiverName: targetFriend.username,
        receiverFriendCode: targetFriend.friendCode,
        giftName: giftNameInput.trim(),
        targetXpGain: targetXp,
        personalMessage: giftPersonalMessageInput.trim(),
      });

      setCreateGiftModalVisible(false);
      setGiftNameInput('');
      setGiftPersonalMessageInput('');
      setGiftTargetXpInput('300');
      await loadData();
      Alert.alert(
        'Cadeau de motivation envoyé ! 🎁⚡',
        `Votre cadeau "${giftNameInput.trim()}" a été envoyé à ${targetFriend.username} ! Il se débloquera dès qu'il/elle aura accumulé +${targetXp} XP.`
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible d’envoyer le cadeau.');
    } finally {
      setCreateGiftLoading(false);
    }
  };

  const handleClaimGift = async (gift: FriendGift) => {
    setCelebratedGift(gift);
    setCelebrateModalVisible(true);
    await claimFriendGift(gift.id);
    await loadData();
  };

  const handleSimulateGift = async () => {
    try {
      await simulateFriendGift('Shaker de Whey Isolate & Cookie Fit', 250);
      await loadData();
      Alert.alert(
        'Cadeau de test reçu ! 🎁',
        'Sarah vous a offert un "Shaker de Whey Isolate & Cookie Fit" avec un objectif de +250 XP (50 XP déjà cumulés pour le test). Faites une séance pour le déverrouiller !'
      );
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de simuler le cadeau.');
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

  const handleCreateChallenge = async () => {
    if (challengeType === 'exercise') {
      const exercise = allExercises.find((e) => e.id === selectedExerciseId);
      if (!exercise) {
        Alert.alert('Exercice requis', 'Veuillez sélectionner un exercice pour ce défi.');
        return;
      }
      const targetReps = parseInt(targetRepsInput, 10) || 10;
      const targetWeight = parseFloat(targetWeightInput) || 0;
      const targetFriend = friendsList.find((f) => f.friendCode === targetFriendCodeInput);

      setCreateChallengeLoading(true);
      try {
        await createFriendChallenge({
          creatorId: profile?.id || 'me',
          creatorName: profile?.username || 'Vous',
          creatorAvatarEmoji: profile?.avatarPokemonEmoji || '⚡',
          targetFriendCode: targetFriendCodeInput,
          targetFriendName: targetFriend?.username,
          type: 'exercise',
          title: `Défi : ${exercise.name} (${targetWeight > 0 ? targetWeight + ' kg × ' : ''}${targetReps} reps)`,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          targetWeightKg: targetWeight,
          targetReps: targetReps,
          instructions:
            challengeInstructionsInput.trim() ||
            `Bats mes ${targetReps} répétitions ${targetWeight > 0 ? 'à ' + targetWeight + ' kg' : ''} !`,
          rewardXp: 150,
        });

        setCreateChallengeModalVisible(false);
        setChallengeInstructionsInput('');
        setTargetWeightInput('');
        setTargetRepsInput('10');
        await loadData();
        Alert.alert('Défi lancé ! 🥊', 'Votre défi a été envoyé avec succès à vos partenaires.');
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible de créer le défi.');
      } finally {
        setCreateChallengeLoading(false);
      }
    } else {
      const program = allPrograms.find((p) => p.id === selectedProgramId);
      if (!program) {
        Alert.alert('Programme requis', 'Veuillez sélectionner un programme.');
        return;
      }
      const targetVolume = parseInt(targetVolumeInput, 10) || 3000;
      const targetFriend = friendsList.find((f) => f.friendCode === targetFriendCodeInput);

      setCreateChallengeLoading(true);
      try {
        await createFriendChallenge({
          creatorId: profile?.id || 'me',
          creatorName: profile?.username || 'Vous',
          creatorAvatarEmoji: profile?.avatarPokemonEmoji || '⚡',
          targetFriendCode: targetFriendCodeInput,
          targetFriendName: targetFriend?.username,
          type: 'program',
          title: `Défi Programme : ${program.name} (Objectif: ${targetVolume.toLocaleString()} kg)`,
          programId: program.id,
          programName: program.name,
          targetVolumeKg: targetVolume,
          instructions:
            challengeInstructionsInput.trim() ||
            `Complète le programme ${program.name} et dépasse les ${targetVolume.toLocaleString()} kg de tonnage total !`,
          rewardXp: 300,
        });

        setCreateChallengeModalVisible(false);
        setChallengeInstructionsInput('');
        setTargetVolumeInput('3000');
        await loadData();
        Alert.alert('Défi Programme lancé ! 📋', 'Votre défi avec objectif de tonnage est en ligne.');
      } catch (err: any) {
        Alert.alert('Erreur', err?.message || 'Impossible de créer le défi.');
      } finally {
        setCreateChallengeLoading(false);
      }
    }
  };

  const handleTakeOnChallenge = async (chlg: FriendChallenge) => {
    if (chlg.type === 'program' && chlg.programId) {
      await startWorkoutFromProgram(chlg.programId);
      router.push('/workout/active');
    } else if (chlg.exerciseId) {
      const foundEx = allExercises.find((e) => e.id === chlg.exerciseId);
      if (foundEx) {
        await startTargetedWorkout(foundEx.name, [foundEx]);
        router.push('/workout/active');
      } else {
        startFreeWorkout();
        router.push('/workout/active');
      }
    } else {
      startFreeWorkout();
      router.push('/workout/active');
    }
  };

  const handleStartRaidWorkout = () => {
    startFreeWorkout();
    router.push('/workout/active');
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
            ⚔️ Défis & Raids
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
                        onPress={() => handleDeclineRequest(req.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pendingRejectBtnText}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pendingAcceptBtn}
                        onPress={() => handleAcceptRequest(req.id)}
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
                onPress={() => setLeaderboardFilter('friends')}
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

            {/* MODULE D'INVITATION À INSTALLER L'APPLICATION AVEC LIEN APK */}
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
                  onPress={handleShareWebInvite}
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

            {/* ======================================================== */}
            {/* SECTION CADEAUX DE MOTIVATION ENTRE AMIS                 */}
            {/* ======================================================== */}
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
                        Alert.alert('Aucun ami', 'Ajoutez d’abord un ami avec son Code Ami pour lui envoyer un cadeau de motivation.');
                        setAddFriendModalVisible(true);
                      } else {
                        if (!giftTargetFriendCode && friendsList.length > 0) {
                          setGiftTargetFriendCode(friendsList[0].friendCode);
                        }
                        setCreateGiftModalVisible(true);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.giftOfferBtnText}>+ Offrir un Cadeau 🎁</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.giftSimulateBtn}
                    onPress={handleSimulateGift}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.giftSimulateBtnText}>🧪 Simuler cadeau reçu</Text>
                  </TouchableOpacity>
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
                            <View style={styles.giftAvatarCircle}>
                              <Text style={{ fontSize: 22 }}>{gift.senderAvatarEmoji || '⚡'}</Text>
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
                              onPress={() => handleClaimGift(gift)}
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
        {/* ONGLET 3 : DÉFIS 1 VS 1 & RAIDS CO-OP                    */}
        {/* ======================================================== */}
        {activeTab === 'raids' && (
          <View>
            {/* SOUS-SÉLECTEUR : DÉFIS 1 VS 1 OU RAID BOSS */}
            <View style={styles.raidsSubNav}>
              <TouchableOpacity
                style={[
                  styles.raidsSubNavBtn,
                  raidsSubTab === 'challenges' && styles.raidsSubNavBtnActive,
                ]}
                onPress={() => setRaidsSubTab('challenges')}
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
                onPress={() => setRaidsSubTab('boss')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.raidsSubNavText,
                    raidsSubTab === 'boss' && styles.raidsSubNavTextActive,
                  ]}
                >
                  🧬 Raid Boss Co-op
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
                    onPress={() => setCreateChallengeModalVisible(true)}
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
                      onPress={() => setCreateChallengeModalVisible(true)}
                      style={{ marginTop: 14 }}
                    />
                  </Card>
                ) : (
                  friendChallenges.map((chlg) => {
                    const isBeaten = chlg.status === 'beaten';
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
                                {chlg.type === 'program' ? '📋 DÉFI PROGRAMME' : '🏋️ DÉFI EXERCICE'}
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
                            onPress={() => handleTakeOnChallenge(chlg)}
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
                      title="⚔️ Combattre le Boss (Lancer la séance de Raid) ▶"
                      variant="primary"
                      size="md"
                      onPress={handleStartRaidWorkout}
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
              Saisissez le Code Ami à 5 chiffres (ex: 48219) ou le Pseudo de votre partenaire :
            </Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Code à 5 chiffres (ex: 48219) ou Pseudo"
              placeholderTextColor={Colors.textMuted}
              value={friendCodeInput}
              onChangeText={setFriendCodeInput}
              autoCapitalize="none"
              maxLength={40}
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

            <TouchableOpacity
              style={styles.simulateInviteBtn}
              onPress={() => {
                setAddFriendModalVisible(false);
                handleSimulateInvite();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.simulateInviteBtnText}>🔔 Simuler une invitation reçue (Test notification)</Text>
            </TouchableOpacity>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.friendGiftMiniBtn}
                        onPress={() => {
                          setGiftTargetFriendCode(f.friendCode);
                          setManageFriendsModalVisible(false);
                          setCreateGiftModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.friendGiftMiniBtnText}>🎁 Offrir</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.friendDeleteBtn}
                        onPress={() => handleRemoveFriend(f.friendId, f.username)}
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

      {/* ======================================================== */}
      {/* MODAL 5 : CRÉER UN DÉFI 1 VS 1                           */}
      {/* ======================================================== */}
      <Modal
        visible={createChallengeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateChallengeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <Text style={styles.modalTitle}>Créer un Défi Sportif 🥊</Text>
            <Text style={styles.modalSub}>
              Fixez un objectif avec vos stats à dépasser pour vos amis !
            </Text>

            <ScrollView style={{ marginVertical: 10 }}>
              {/* Type de défi : Exercice vs Programme */}
              <Text style={styles.inputLabel}>Type de Défi</Text>
              <View style={styles.challengeTypeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.challengeTypeToggleBtn,
                    challengeType === 'exercise' && styles.challengeTypeToggleBtnActive,
                  ]}
                  onPress={() => setChallengeType('exercise')}
                >
                  <Text
                    style={[
                      styles.challengeTypeToggleText,
                      challengeType === 'exercise' && styles.challengeTypeToggleTextActive,
                    ]}
                  >
                    🏋️ Exercice Unique
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.challengeTypeToggleBtn,
                    challengeType === 'program' && styles.challengeTypeToggleBtnActive,
                  ]}
                  onPress={() => setChallengeType('program')}
                >
                  <Text
                    style={[
                      styles.challengeTypeToggleText,
                      challengeType === 'program' && styles.challengeTypeToggleTextActive,
                    ]}
                  >
                    📋 Programme Complet
                  </Text>
                </TouchableOpacity>
              </View>

              {challengeType === 'exercise' ? (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Sélectionner l’exercice</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    {allExercises.slice(0, 16).map((ex) => {
                      const isSel = selectedExerciseId === ex.id;
                      return (
                        <TouchableOpacity
                          key={ex.id}
                          style={[
                            styles.chipSelectItem,
                            isSel && styles.chipSelectItemActive,
                          ]}
                          onPress={() => setSelectedExerciseId(ex.id)}
                        >
                          <Text
                            style={[
                              styles.chipSelectText,
                              isSel && styles.chipSelectTextActive,
                            ]}
                          >
                            {ex.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Charge cible (kg)</Text>
                      <TextInput
                        style={styles.modalTextInput}
                        placeholder="Ex: 80"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={targetWeightInput}
                        onChangeText={setTargetWeightInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Reps cibles</Text>
                      <TextInput
                        style={styles.modalTextInput}
                        placeholder="Ex: 10"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={targetRepsInput}
                        onChangeText={setTargetRepsInput}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Sélectionner le programme</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    {allPrograms.map((prog) => {
                      const isSel = selectedProgramId === prog.id;
                      return (
                        <TouchableOpacity
                          key={prog.id}
                          style={[
                            styles.chipSelectItem,
                            isSel && styles.chipSelectItemActive,
                          ]}
                          onPress={() => setSelectedProgramId(prog.id)}
                        >
                          <Text
                            style={[
                              styles.chipSelectText,
                              isSel && styles.chipSelectTextActive,
                            ]}
                          >
                            {prog.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Tonnage total cible à dépasser (kg)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Ex: 4000"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={targetVolumeInput}
                    onChangeText={setTargetVolumeInput}
                  />
                </>
              )}

              {/* Destinataire */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Destinataire du Défi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.chipSelectItem,
                    targetFriendCodeInput === 'all' && styles.chipSelectItemActive,
                  ]}
                  onPress={() => setTargetFriendCodeInput('all')}
                >
                  <Text
                    style={[
                      styles.chipSelectText,
                      targetFriendCodeInput === 'all' && styles.chipSelectTextActive,
                    ]}
                  >
                    🌐 Tous les athlètes
                  </Text>
                </TouchableOpacity>
                {friendsList.map((f) => {
                  const isSel = targetFriendCodeInput === f.friendCode;
                  return (
                    <TouchableOpacity
                      key={f.friendId}
                      style={[
                        styles.chipSelectItem,
                        isSel && styles.chipSelectItemActive,
                      ]}
                      onPress={() => setTargetFriendCodeInput(f.friendCode)}
                    >
                      <Text
                        style={[
                          styles.chipSelectText,
                          isSel && styles.chipSelectTextActive,
                        ]}
                      >
                        {f.avatarPokemonEmoji} {f.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Message provocateur / motivation */}
              <Text style={styles.inputLabel}>Message ou consigne personnalisée</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Ex: Forme stricte requise, bats mes répétitions si tu l'oses !"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={challengeInstructionsInput}
                onChangeText={setChallengeInstructionsInput}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setCreateChallengeModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={createChallengeLoading ? 'Envoi...' : 'Lancer le Défi ⚔️'}
                variant="primary"
                size="md"
                onPress={handleCreateChallenge}
                disabled={createChallengeLoading}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL : OFFRIR UN CADEAU DE MOTIVATION                   */}
      {/* ======================================================== */}
      <Modal
        visible={createGiftModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateGiftModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={styles.giftModalIconBox}>
                  <Text style={{ fontSize: 32 }}>🎁</Text>
                </View>
                <Text style={styles.modalTitle}>Offrir un Cadeau de Motivation</Text>
                <Text style={styles.modalSub}>
                  Promettez un cadeau concret à un ami. Il se débloquera dès qu’il aura gagné le quota d’XP requis !
                </Text>
              </View>

              {/* Sélection de l'ami */}
              <Text style={styles.inputLabel}>Choisir le destinataire *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {friendsList.map((f) => {
                  const isSel = giftTargetFriendCode === f.friendCode;
                  return (
                    <TouchableOpacity
                      key={f.friendId}
                      style={[
                        styles.chipSelectItem,
                        isSel && styles.chipSelectItemActive,
                      ]}
                      onPress={() => setGiftTargetFriendCode(f.friendCode)}
                    >
                      <Text
                        style={[
                          styles.chipSelectText,
                          isSel && styles.chipSelectTextActive,
                        ]}
                      >
                        {f.avatarPokemonEmoji} {f.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Nom du cadeau */}
              <Text style={styles.inputLabel}>Nom du cadeau promis *</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Ex: Shaker de Whey, Resto post-séance, Barres..."
                placeholderTextColor={Colors.textMuted}
                value={giftNameInput}
                onChangeText={setGiftNameInput}
                maxLength={60}
              />

              {/* Suggestions rapides de cadeaux */}
              <View style={styles.quickGiftSuggestionsRow}>
                {['Shaker de Whey', 'Resto post-séance', 'Barres Protéinées', 'Place de Ciné'].map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    style={styles.quickGiftChip}
                    onPress={() => setGiftNameInput(sug)}
                  >
                    <Text style={styles.quickGiftChipText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quota d'XP requis */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                XP à obtenir pour débloquer le cadeau *
              </Text>
              <View style={styles.xpPresetRow}>
                {['150', '300', '500', '1000'].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.xpPresetBtn,
                      giftTargetXpInput === val && styles.xpPresetBtnActive,
                    ]}
                    onPress={() => setGiftTargetXpInput(val)}
                  >
                    <Text
                      style={[
                        styles.xpPresetBtnText,
                        giftTargetXpInput === val && styles.xpPresetBtnTextActive,
                      ]}
                    >
                      +{val} XP
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.modalTextInput, { marginTop: 8 }]}
                placeholder="Ou montant personnalisé (ex: 750)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={giftTargetXpInput}
                onChangeText={setGiftTargetXpInput}
              />

              {/* Message personnel */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                Mot d’encouragement (optionnel)
              </Text>
              <TextInput
                style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Ex: Donne tout sur tes prochaines séances, ce cadeau est pour toi !"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={giftPersonalMessageInput}
                onChangeText={setGiftPersonalMessageInput}
                maxLength={140}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={() => setCreateGiftModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title={createGiftLoading ? 'Envoi...' : 'Envoyer le Cadeau 🎁'}
                  variant="primary"
                  size="md"
                  onPress={handleCreateGift}
                  disabled={createGiftLoading}
                  style={{ flex: 1.5 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL : CÉLÉBRATION DU CADEAU DÉVERROUILLÉ               */}
      {/* ======================================================== */}
      <Modal
        visible={celebrateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCelebrateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { alignItems: 'center', paddingVertical: 24 }]}>
            <View style={styles.celebrateGiftIcon}>
              <Text style={{ fontSize: 50 }}>🎁🎉</Text>
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 10 }]}>
              CADEAU RÉCLAMÉ !
            </Text>
            <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 4 }]}>
              Félicitations pour vos efforts ! Vous avez atteint les +{celebratedGift?.targetXpGain} XP requis.
            </Text>

            <View style={styles.celebrateGiftBox}>
              <Text style={styles.celebrateGiftName}>{celebratedGift?.giftName}</Text>
              <Text style={styles.celebrateGiftSender}>
                Offert avec fierté par {celebratedGift?.senderName}
              </Text>
              {celebratedGift?.personalMessage ? (
                <Text style={styles.celebrateGiftQuote}>
                  « {celebratedGift.personalMessage} »
                </Text>
              ) : null}
            </View>

            <Text style={{ color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 14 }}>
              N’oubliez pas de contacter {celebratedGift?.senderName} pour récupérer votre dû ! 💪
            </Text>

            <Button
              title="C’est noté ! Merci 🚀"
              variant="primary"
              size="lg"
              onPress={() => setCelebrateModalVisible(false)}
              style={{ width: '100%' }}
            />
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
    color: Colors.primary,
    fontWeight: '900',
  },
  youBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    color: Colors.primaryText,
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
  raidsSubNav: {
    flexDirection: 'row',
    backgroundColor: '#0D1321',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1A2538',
  },
  raidsSubNavBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  raidsSubNavBtnActive: {
    backgroundColor: '#1E2C44',
    borderWidth: 1,
    borderColor: '#FF5A1F',
  },
  raidsSubNavText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  raidsSubNavTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  challengeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  newChallengeBtn: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newChallengeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  challengeCard: {
    backgroundColor: '#151E2E',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#23324A',
  },
  challengeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  challengeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
  },
  challengeCreatorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  challengeTypeBadge: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  challengeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  challengeStatusPillActive: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderColor: 'rgba(255, 90, 31, 0.4)',
  },
  challengeStatusPillBeaten: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  challengeStatusPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  challengeTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  challengeStatsRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0F1626',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  challengeStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  challengeStatLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  challengeStatValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeInstructionsBox: {
    backgroundColor: 'rgba(255, 90, 31, 0.08)',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5A1F',
    marginTop: 4,
  },
  challengeInstructionsText: {
    color: '#FFB899',
    fontSize: 12,
    fontStyle: 'italic',
  },
  challengeTypeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  challengeTypeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1F2E45',
  },
  challengeTypeToggleBtnActive: {
    backgroundColor: '#1E2C44',
    borderColor: '#FF5A1F',
  },
  challengeTypeToggleText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  challengeTypeToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  chipSelectItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F1626',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1F2E45',
  },
  chipSelectItemActive: {
    backgroundColor: '#FF5A1F',
    borderColor: '#FF5A1F',
  },
  chipSelectText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  pendingContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pendingPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  pendingSectionTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pendingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  pendingAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  pendingSenderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pendingSenderCode: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  pendingActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingRejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  pendingRejectBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  pendingAcceptBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pendingAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  simulateInviteBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
  },
  simulateInviteBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  // ==========================================
  // STYLES CADEAUX DE MOTIVATION
  // ==========================================
  unlockedGiftAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 90, 31, 0.16)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF5A1F',
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  unlockedGiftAlertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 90, 31, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockedGiftAlertTitle: {
    color: '#FF7A45',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unlockedGiftAlertSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  unlockedGiftAlertArrow: {
    color: '#FF7A45',
    fontSize: 18,
    fontWeight: '900',
  },
  giftsMainSectionCard: {
    backgroundColor: '#121A28',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  giftsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  giftsSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  giftsBadgeCount: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  giftsBadgeCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  giftsSectionSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  giftsActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  giftOfferBtn: {
    flex: 1.2,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftOfferBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  giftSimulateBtn: {
    flex: 1,
    backgroundColor: '#1A263A',
    borderWidth: 1,
    borderColor: '#2F4363',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftSimulateBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  giftsSubHeaderTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  giftEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1624',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#192436',
  },
  giftEmptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  giftCardItem: {
    backgroundColor: '#0F1726',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2D44',
    marginBottom: 10,
  },
  giftCardItemUnlocked: {
    borderColor: '#FF5A1F',
    backgroundColor: 'rgba(255, 90, 31, 0.08)',
  },
  giftCardItemClaimed: {
    borderColor: '#10B981',
    opacity: 0.75,
  },
  giftCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  giftAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C273C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftSenderText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  giftTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  giftPersonalMsg: {
    color: '#93C5FD',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 3,
  },
  giftBadgeActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  giftBadgeActiveText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
  },
  giftBadgeUnlocked: {
    backgroundColor: 'rgba(255, 90, 31, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF5A1F',
  },
  giftBadgeUnlockedText: {
    color: '#FF7A45',
    fontSize: 10,
    fontWeight: '900',
  },
  giftBadgeClaimed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  giftBadgeClaimedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
  },
  giftProgressTrack: {
    height: 8,
    backgroundColor: '#1E2C42',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 10,
  },
  giftProgressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  giftProgressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  giftProgressStatsLeft: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  giftProgressStatsRight: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  claimGiftActionBtn: {
    backgroundColor: '#FF5A1F',
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimGiftActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  giftSentCardItem: {
    backgroundColor: '#0E1522',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#182436',
    marginBottom: 8,
  },
  giftSentRecipientText: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  giftSentStatusText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  giftSentTitleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  giftSentProgressTrack: {
    height: 6,
    backgroundColor: '#1A2536',
    borderRadius: 3,
    overflow: 'hidden',
  },
  giftSentProgressBar: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3,
  },
  friendGiftMiniBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  friendGiftMiniBtnText: {
    color: '#FF7A45',
    fontSize: 11,
    fontWeight: '800',
  },
  giftModalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 90, 31, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FF5A1F',
    marginBottom: 8,
  },
  quickGiftSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickGiftChip: {
    backgroundColor: '#162235',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  quickGiftChipText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  xpPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  xpPresetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#141D2C',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  xpPresetBtnActive: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    borderColor: '#FF5A1F',
  },
  xpPresetBtnText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  xpPresetBtnTextActive: {
    color: '#FF7A45',
    fontWeight: '900',
  },
  celebrateGiftIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF5A1F',
  },
  celebrateGiftBox: {
    backgroundColor: '#121A28',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#223450',
    width: '100%',
    alignItems: 'center',
    marginVertical: 14,
  },
  celebrateGiftName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  celebrateGiftSender: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  celebrateGiftQuote: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});
