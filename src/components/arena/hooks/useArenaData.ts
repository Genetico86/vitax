import { useState, useCallback, useEffect } from 'react';
import { Share, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { showAlert } from '../../../utils/alert';
import {
  TrainerProfile,
  LeaderboardEntry,
  LeagueConfig,
  CoOpRaidBoss,
  FriendEntry,
  FriendChallenge,
  FriendRequest,
  FriendGift,
} from '../../../types/social';
import {
  createFriendGift,
  getFriendGifts,
  claimFriendGift,
  simulateFriendGift,
} from '../../../services/friendGiftService';
import { Exercise, Program } from '../../../types';
import {
  getOrCreateTrainerProfile,
  getLeagueLeaderboard,
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
  invalidateWeeklyStatsCache,
  subscribeToLeaderboardUpdates,
} from '../../../services/multiplayerService';
import { invalidateGamificationCache } from '../../../services/gamificationService';
import { getSupabaseClient, isSupabaseConfigured } from '../../../services/supabaseClient';
import { getAllExercises } from '../../../database/exerciseRepository';
import { getAllPrograms } from '../../../database/programRepository';
import { useWorkoutSessionStore } from '../../../stores/workoutSessionStore';
import {
  registerTrainer,
  loginTrainer,
  getPersistedSession,
  logoutTrainer,
} from '../../../services/authService';
import { isDurationExercise, getExerciseUnitInfo } from '../../../utils/exerciseUnits';

export const WEB_APP_URL = 'https://vitaxsport.vercel.app';

export type ArenaTab = 'leaderboard' | 'raids';
export type LeaderboardFilter = 'global' | 'friends';
export type LeaderboardTimeframe = 'weekly' | 'allTime';

export function useArenaData(initialTab?: ArenaTab) {
  const [activeTab, setActiveTab] = useState<ArenaTab>(initialTab || 'leaderboard');
  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>('global');
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<LeaderboardTimeframe>('weekly');

  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendsList, setFriendsList] = useState<FriendEntry[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<{
    league: LeagueConfig;
    entries: LeaderboardEntry[];
    currentUserRank: number;
    timeRemainingText: string;
    totalParticipants: number;
    timeframe?: LeaderboardTimeframe;
  } | null>(null);
  const [raidBoss, setRaidBoss] = useState<CoOpRaidBoss | null>(null);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Cadeaux de Motivation
  const [friendGifts, setFriendGifts] = useState<{
    sent: FriendGift[];
    received: FriendGift[];
    unlockedUnclaimedCount: number;
  }>({ sent: [], received: [], unlockedUnclaimedCount: 0 });

  // Défis & Raids
  const [raidsSubTab, setRaidsSubTab] = useState<'challenges' | 'boss'>('challenges');
  const [friendChallenges, setFriendChallenges] = useState<FriendChallenge[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);

  const { startTargetedWorkout, startWorkoutFromProgram, startFreeWorkout } =
    useWorkoutSessionStore();

  const loadData = useCallback(async () => {
    try {
      const session = await getPersistedSession();
      setIsLoggedIn(Boolean(session?.isLoggedIn));

      const prof = await getOrCreateTrainerProfile();
      setProfile(prof);

      // 1. Synchronisation profil en arrière-plan sans bloquer
      void syncTrainerProfileToSupabase(prof);

      // 2. Charger le classement en priorité absolue
      const lbPromise = getLeagueLeaderboard(leaderboardFilter, leaderboardTimeframe)
        .then((lb) => {
          setLeaderboardData(lb);
          setLoading(false);
          return lb;
        })
        .catch((err) => {
          console.warn('Erreur chargement leaderboard:', err);
          setLoading(false);
          return null;
        });

      // 3. Charger les exercices et programmes en tâche de fond pour les modales
      if (allExercises.length === 0) {
        void Promise.all([
          getAllExercises().catch(() => []),
          getAllPrograms().catch(() => []),
        ]).then(([exList, progList]) => {
          setAllExercises(exList);
          setAllPrograms(progList);
        });
      }

      // 4. Charger les données sociales en arrière-plan avec isolation d'erreurs
      const [friends, raid, chlgList, reqList, giftsData] = await Promise.all([
        getFriendsList().catch(() => []),
        getActiveCoOpRaidBoss().catch(() => null),
        getFriendChallenges().catch(() => []),
        getPendingFriendRequests().catch(() => []),
        getFriendGifts().catch(() => ({ sent: [], received: [], unlockedUnclaimedCount: 0 })),
      ]);

      setFriendsList(friends);
      setRaidBoss(raid);
      setFriendChallenges(chlgList);
      setPendingRequests(reqList);
      setFriendGifts(giftsData);

      await lbPromise;
    } catch (err) {
      console.error('Erreur chargement arène:', err);
      setLoading(false);
    }
  }, [leaderboardFilter, leaderboardTimeframe, allExercises.length]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 1. Écoute immédiate des événements locaux (ex: fin de séance d'entraînement, gain d'XP)
  useEffect(() => {
    const unsubscribe = subscribeToLeaderboardUpdates(() => {
      void loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // 2. Écoute Supabase Realtime (multiplayer cloud) pour synchroniser en temps réel
  // les scores des autres utilisateurs sans avoir à quitter l'application
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerDebouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadData();
      }, 600);
    };

    let channel: any = null;
    try {
      channel = supabase
        .channel('vitax-realtime-arena-leaderboard')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'weekly_leaderboards' },
          () => {
            triggerDebouncedReload();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload: any) => {
            const newRow = payload?.new;
            const oldRow = payload?.old;
            if (
              !oldRow ||
              newRow?.total_xp !== oldRow?.total_xp ||
              newRow?.current_league !== oldRow?.current_league ||
              newRow?.total_workouts !== oldRow?.total_workouts
            ) {
              triggerDebouncedReload();
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Erreur souscription Supabase Realtime leaderboard:', err);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel && isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          try {
            void client.removeChannel(channel);
          } catch {}
        }
      }
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateWeeklyStatsCache();
    invalidateGamificationCache();
    await loadData();
    setRefreshing(false);
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    showAlert(
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
            showAlert('Ami retiré', `${friendName} a été retiré de votre liste.`);
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
        showAlert('Code copié ! 📋', `Votre Code Ami (${profile.friendCode}) a été copié dans le presse-papier.`);
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
          showAlert('Code copié ! 📋', `Votre Code Ami (${profile.friendCode}) a été copié dans le presse-papier.`);
        } catch {}
      }
    }
  };

  const handleShareWebInvite = async () => {
    if (!profile) return;
    const inviteMessage = `🏋️‍♂️ Salut ! Je t'invite à rejoindre Vitax, notre application de musculation & défis sportifs.\n\n🌐 Ouvre l'application web directement ici (sans rien installer) :\n${WEB_APP_URL}\n\n🏆 Dès ton arrivée, ajoute mon Code Athlète pour qu'on partage nos classements et nos défis : ${profile.friendCode}\n\nÀ très vite dans l'arène ! ⚔️`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteMessage);
        showAlert('Invitation copiée ! 📋', 'Le message d’invitation avec votre Code Ami et le lien web a été copié.');
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
          showAlert('Invitation copiée ! 📋', 'Le message d’invitation avec votre Code Ami et le lien web a été copié.');
        } catch {}
      }
    }
  };

  const handleAddFriend = async (friendCode: string) => {
    const res = await addFriendByCode(friendCode);
    if (res.success && res.friend) {
      await loadData();
      showAlert(
        'Nouvel ami ajouté ! 🎉',
        `${res.friend.username} (${res.friend.friendCode}) a été ajouté à votre cercle d’amis !`
      );
      return true;
    } else {
      showAlert('Erreur', res.error || 'Impossible d’ajouter cet ami.');
      return false;
    }
  };

  const handleInviteAthlete = (entry: LeaderboardEntry) => {
    const friendIdentifier = entry.friendCode || entry.username;
    if (!friendIdentifier) return;

    showAlert(
      'Ajouter en ami 👥',
      `Voulez-vous inviter ${entry.username} à rejoindre votre cercle d’athlètes ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Inviter / Ajouter',
          onPress: async () => {
            await handleAddFriend(friendIdentifier);
          },
        },
      ]
    );
  };

  const handleAcceptRequest = async (requestId: string) => {
    const res = await acceptFriendRequest(requestId);
    if (res.success && res.friend) {
      await loadData();
      showAlert('Ami accepté ! 🎉', `${res.friend.username} a été ajouté à votre cercle d’amis !`);
    } else {
      showAlert('Erreur', res.error || 'Impossible d’accepter cette demande.');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    await declineFriendRequest(requestId);
    await loadData();
    showAlert('Demande refusée', 'La demande d’ami a été retirée.');
  };

  const handleSimulateInvite = async () => {
    await simulateFriendRequest('Alexandre (Coach)', 'VTX-5491');
    await loadData();
    showAlert('Notification simulée ! 🔔', 'Une invitation d’ami vient d’être générée. La notification apparaît en haut de l’écran !');
  };

  const handleCreateGift = async (
    targetFriendCode: string,
    giftName: string,
    targetXp: number,
    personalMessage?: string
  ) => {
    const targetFriend = friendsList.find((f) => f.friendCode === targetFriendCode);
    if (!targetFriend) {
      showAlert('Ami introuvable', 'Veuillez sélectionner un ami dans votre cercle.');
      return false;
    }

    try {
      await createFriendGift({
        receiverId: targetFriend.friendId,
        receiverName: targetFriend.username,
        receiverFriendCode: targetFriend.friendCode,
        giftName,
        targetXpGain: targetXp,
        personalMessage,
      });

      await loadData();
      showAlert(
        'Cadeau de motivation envoyé ! 🎁⚡',
        `Votre cadeau "${giftName}" a été envoyé à ${targetFriend.username} ! Il se débloquera dès qu'il/elle aura accumulé +${targetXp} XP.`
      );
      return true;
    } catch (err: any) {
      showAlert('Erreur', err?.message || 'Impossible d’envoyer le cadeau.');
      return false;
    }
  };

  const handleClaimGift = async (gift: FriendGift) => {
    await claimFriendGift(gift.id);
    await loadData();
  };

  const handleSimulateGift = async () => {
    try {
      await simulateFriendGift('Shaker de Whey Isolate & Cookie Fit', 250);
      await loadData();
      showAlert(
        'Cadeau de test reçu ! 🎁',
        'Sarah vous a offert un "Shaker de Whey Isolate & Cookie Fit" avec un objectif de +250 XP (50 XP déjà cumulés pour le test). Faites une séance pour le déverrouiller !'
      );
    } catch (err: any) {
      showAlert('Erreur', err?.message || 'Impossible de simuler le cadeau.');
    }
  };

  const handleAuthSubmit = async (mode: 'register' | 'login', u: string, p: string) => {
    if (mode === 'register') {
      const res = await registerTrainer(u, p);
      if (res.success) {
        await loadData();
        showAlert(
          'Compte Athlète créé ! 🏆',
          `Bienvenue ${u} ! Vos séances et statistiques sont désormais sauvegardées en permanence sur le cloud.`
        );
        return true;
      } else {
        showAlert('Erreur', res.error || 'Impossible de créer le compte.');
        return false;
      }
    } else {
      const res = await loginTrainer(u, p);
      if (res.success) {
        await loadData();
        showAlert(
          'Rebonjour ! ⚡',
          `Ravi de vous revoir ${u}. Vos statistiques d’entraînement et séances ont été synchronisées avec succès.`
        );
        return true;
      } else {
        showAlert('Erreur de connexion', res.error || 'Identifiants incorrects.');
        return false;
      }
    }
  };

  const handleLogout = async () => {
    showAlert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter de votre compte Athlète ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await logoutTrainer();
            await loadData();
            showAlert('Déconnecté', 'Vous êtes repassé en mode local.');
          },
        },
      ]
    );
  };

  const handleClaimReward = async () => {
    try {
      const reward = await claimRaidVictoryReward();
      await loadData();
      showAlert(
        'Victoire de Raid ! 🏆',
        `Vous avez récupéré votre récompense de Raid : +${reward.rewardXp} XP !`
      );
    } catch (e: any) {
      showAlert('Info', e.message || 'Récompense non disponible.');
    }
  };

  const handleCreateChallenge = async (params: {
    type: 'exercise' | 'program';
    selectedExerciseId?: string;
    selectedProgramId?: string;
    targetWeight?: number;
    targetReps?: number;
    targetVolume?: number;
    targetFriendCodeInput: string;
    instructions?: string;
  }) => {
    const targetFriend = friendsList.find((f) => f.friendCode === params.targetFriendCodeInput);

    if (params.type === 'exercise') {
      const exercise = allExercises.find((e) => e.id === params.selectedExerciseId);
      if (!exercise) {
        showAlert('Exercice requis', 'Veuillez sélectionner un exercice pour ce défi.');
        return false;
      }
      const isDuration = isDurationExercise(exercise);
      const unitInfo = getExerciseUnitInfo(exercise);
      const targetReps = params.targetReps || (isDuration ? 15 : 10);
      const targetWeight = params.targetWeight || 0;

      let title = '';
      let defaultInstructions = '';
      if (isDuration) {
        const speedText = targetWeight > 0 ? ` @ ${targetWeight} ${unitInfo.loadUnit}` : '';
        title = `Défi : ${exercise.name} (${targetReps} min${speedText})`;
        defaultInstructions = `Tiens au moins ${targetReps} minutes${targetWeight > 0 ? ' à ' + targetWeight + ' ' + unitInfo.loadUnit : ''} sur ${exercise.name} !`;
      } else {
        const weightText = targetWeight > 0 ? `${targetWeight} kg × ` : '';
        title = `Défi : ${exercise.name} (${weightText}${targetReps} reps)`;
        defaultInstructions = `Bats mes ${targetReps} répétitions ${targetWeight > 0 ? 'à ' + targetWeight + ' kg' : ''} !`;
      }

      try {
        await createFriendChallenge({
          creatorId: profile?.id || 'me',
          creatorName: profile?.username || 'Vous',
          creatorAvatarEmoji: profile?.avatarPokemonEmoji || '⚡',
          targetFriendCode: params.targetFriendCodeInput,
          targetFriendName: targetFriend?.username,
          type: 'exercise',
          title,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          targetWeightKg: targetWeight,
          targetReps: targetReps,
          targetDurationSeconds: isDuration ? targetReps * 60 : undefined,
          instructions: params.instructions || defaultInstructions,
          rewardXp: 150,
        });

        await loadData();
        showAlert('Défi lancé ! 🥊', 'Votre défi a été envoyé avec succès à vos partenaires.');
        return true;
      } catch (err: any) {
        showAlert('Erreur', err?.message || 'Impossible de créer le défi.');
        return false;
      }
    } else {
      const program = allPrograms.find((p) => p.id === params.selectedProgramId);
      if (!program) {
        showAlert('Programme requis', 'Veuillez sélectionner un programme.');
        return false;
      }
      const targetVolume = params.targetVolume || 3000;

      try {
        await createFriendChallenge({
          creatorId: profile?.id || 'me',
          creatorName: profile?.username || 'Vous',
          creatorAvatarEmoji: profile?.avatarPokemonEmoji || '⚡',
          targetFriendCode: params.targetFriendCodeInput,
          targetFriendName: targetFriend?.username,
          type: 'program',
          title: `Défi Programme : ${program.name} (Objectif: ${targetVolume.toLocaleString()} kg)`,
          programId: program.id,
          programName: program.name,
          targetVolumeKg: targetVolume,
          instructions:
            params.instructions ||
            `Complète le programme ${program.name} et dépasse les ${targetVolume.toLocaleString()} kg de tonnage total !`,
          rewardXp: 300,
        });

        await loadData();
        showAlert('Défi Programme lancé ! 📋', 'Votre défi avec objectif de tonnage est en ligne.');
        return true;
      } catch (err: any) {
        showAlert('Erreur', err?.message || 'Impossible de créer le défi.');
        return false;
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

  return {
    activeTab,
    setActiveTab,
    leaderboardFilter,
    setLeaderboardFilter,
    leaderboardTimeframe,
    setLeaderboardTimeframe,
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
    reload: loadData,
  };
}
