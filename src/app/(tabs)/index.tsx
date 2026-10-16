import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAllPrograms } from '../../database/programRepository';
import {
  getWeeklyFitnessStats,
  WeeklyFitnessStats,
} from '../../database/workoutRepository';
import { Program, Exercise } from '../../types';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import {
  getUserGamificationStats,
  LevelInfo,
  POKEMON_BADGE_TIERS,
  computeLevelInfoForXp,
} from '../../services/gamificationService';
import { getFavoriteExercises, getFavoriteExerciseIds } from '../../services/favoritesService';
import { registerTrainer, loginTrainer, logoutTrainer, getPersistedSession } from '../../services/authService';
import { getPendingFriendRequestsCount } from '../../services/multiplayerService';

export default function HomeScreen() {
  const { height: screenHeight } = useWindowDimensions();

  const isSmallScreen = screenHeight < 720;
  const isMediumScreen = screenHeight >= 720 && screenHeight < 820;
  // screenHeight >= 820 : Grands smartphones modernes (Pixel 10a natif, Galaxy S23/S24, iPhone Pro Max, desktop)

  const dynamic = useMemo(() => {
    // -------------------------------------------------------------
    // TIER 1 : PETITS ÉCRANS (< 720 dp, ex: iPhone SE)
    // -------------------------------------------------------------
    if (isSmallScreen) {
      return {
        scrollContent: {
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 14,
        },
        topXpCard: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 8,
          borderRadius: 16,
        },
        topUserHeader: {
          marginBottom: 6,
        },
        userGreetingText: {
          fontSize: 20,
          fontWeight: '900' as const,
        },
        userSubDot: {
          fontSize: 13,
        },
        userSubText: {
          fontSize: 14,
          fontWeight: '800' as const,
        },
        athleteHeaderBadge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 9,
        },
        athleteHeaderBadgeText: {
          fontSize: 13,
          fontWeight: '900' as const,
        },
        xpTrack: {
          height: 7,
          borderRadius: 4,
          marginBottom: 3,
        },
        xpNumbersText: {
          fontSize: 12.5,
          fontWeight: '700' as const,
        },
        xpPercentText: {
          fontSize: 12.5,
          fontWeight: '900' as const,
        },
        activeBanner: {
          paddingVertical: 8,
          paddingHorizontal: 11,
          marginBottom: 8,
          minHeight: 50,
          gap: 8,
        },
        prioritySection: {
          marginBottom: 8,
        },
        heroCoachCard: {
          paddingVertical: 14,
          paddingHorizontal: 15,
          marginBottom: 8,
          minHeight: 112,
          gap: 12,
          borderRadius: 16,
        },
        heroCoachIconBox: {
          width: 48,
          height: 48,
          borderRadius: 14,
        },
        heroCoachIconSize: 28,
        heroCoachTitle: {
          fontSize: 21,
          fontWeight: '900' as const,
        },
        heroCoachTag: {
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        heroCoachTagText: {
          fontSize: 10,
          fontWeight: '900' as const,
        },
        heroCoachSubtitle: {
          fontSize: 13.5,
          marginTop: 2,
        },
        heroCoachActionPill: {
          paddingHorizontal: 13,
          paddingVertical: 8,
          borderRadius: 10,
        },
        heroCoachActionText: {
          fontSize: 14,
          fontWeight: '900' as const,
        },
        rowSpacing: {
          gap: 8,
          marginBottom: 8,
        },
        cardRow: {
          paddingVertical: 13,
          paddingHorizontal: 12,
          gap: 10,
          minHeight: 92,
          borderRadius: 16,
        },
        iconCircle: {
          width: 46,
          height: 46,
          borderRadius: 14,
        },
        cardIconSize: 26,
        cardTitle: {
          fontSize: 18.5,
          fontWeight: '900' as const,
          lineHeight: 22,
        },
        cardSub: {
          fontSize: 13,
          fontWeight: '700' as const,
          marginTop: 2,
        },
        weeklyFitnessCard: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 8,
          borderRadius: 16,
        },
        weeklyFitnessHeader: {
          marginBottom: 7,
        },
        weeklyTitleIconSize: 16,
        weeklyFitnessTitle: {
          fontSize: 17,
          fontWeight: '900' as const,
        },
        weeklyFitnessBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 7,
        },
        weeklyFitnessBadgeText: {
          fontSize: 12,
          fontWeight: '800' as const,
        },
        weeklyDaysRow: {
          marginBottom: 3,
        },
        dayPill: {
          width: 32,
          height: 32,
          borderRadius: 8,
        },
        dayPillText: {
          fontSize: 12,
          fontWeight: '800' as const,
        },
        showWeeklyFooter: false,
        weeklyStatsSummaryText: {
          fontSize: 12,
          fontWeight: '700' as const,
        },
      };
    }

    // -------------------------------------------------------------
    // TIER 2 : ÉCRANS STANDARDS (720 <= screenHeight < 820 dp)
    // CORRESPOND PARFAITEMENT AU PIXEL 10A / PIXEL 8 SUR NAVIGATEUR AVEC BARRE D'ADRESSE
    // -------------------------------------------------------------
    if (isMediumScreen) {
      return {
        scrollContent: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 18,
        },
        topXpCard: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 10,
          borderRadius: 18,
        },
        topUserHeader: {
          marginBottom: 7,
        },
        userGreetingText: {
          fontSize: 22,
          fontWeight: '900' as const,
        },
        userSubDot: {
          fontSize: 14,
        },
        userSubText: {
          fontSize: 15.5,
          fontWeight: '800' as const,
        },
        athleteHeaderBadge: {
          paddingHorizontal: 11,
          paddingVertical: 5,
          borderRadius: 10,
        },
        athleteHeaderBadgeText: {
          fontSize: 14,
          fontWeight: '900' as const,
        },
        xpTrack: {
          height: 8,
          borderRadius: 4,
          marginBottom: 3,
        },
        xpNumbersText: {
          fontSize: 13.5,
          fontWeight: '700' as const,
        },
        xpPercentText: {
          fontSize: 13.5,
          fontWeight: '900' as const,
        },
        activeBanner: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 10,
          minHeight: 52,
          gap: 10,
        },
        prioritySection: {
          marginBottom: 10,
        },
        heroCoachCard: {
          paddingVertical: 16,
          paddingHorizontal: 16,
          marginBottom: 10,
          minHeight: 126,
          gap: 14,
          borderRadius: 18,
        },
        heroCoachIconBox: {
          width: 52,
          height: 52,
          borderRadius: 16,
        },
        heroCoachIconSize: 32,
        heroCoachTitle: {
          fontSize: 23,
          fontWeight: '900' as const,
        },
        heroCoachTag: {
          paddingHorizontal: 7,
          paddingVertical: 2.5,
        },
        heroCoachTagText: {
          fontSize: 11,
          fontWeight: '900' as const,
        },
        heroCoachSubtitle: {
          fontSize: 14.5,
          marginTop: 2,
        },
        heroCoachActionPill: {
          paddingHorizontal: 15,
          paddingVertical: 10,
          borderRadius: 12,
        },
        heroCoachActionText: {
          fontSize: 15,
          fontWeight: '900' as const,
        },
        rowSpacing: {
          gap: 10,
          marginBottom: 10,
        },
        cardRow: {
          paddingVertical: 15,
          paddingHorizontal: 14,
          gap: 11,
          minHeight: 106,
          borderRadius: 18,
        },
        iconCircle: {
          width: 52,
          height: 52,
          borderRadius: 15,
        },
        cardIconSize: 30,
        cardTitle: {
          fontSize: 20,
          fontWeight: '900' as const,
          lineHeight: 24,
        },
        cardSub: {
          fontSize: 14,
          fontWeight: '700' as const,
          marginTop: 3,
        },
        weeklyFitnessCard: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 10,
          borderRadius: 18,
        },
        weeklyFitnessHeader: {
          marginBottom: 8,
        },
        weeklyTitleIconSize: 18,
        weeklyFitnessTitle: {
          fontSize: 18.5,
          fontWeight: '900' as const,
        },
        weeklyFitnessBadge: {
          paddingHorizontal: 9,
          paddingVertical: 3.5,
          borderRadius: 8,
        },
        weeklyFitnessBadgeText: {
          fontSize: 13,
          fontWeight: '800' as const,
        },
        weeklyDaysRow: {
          marginBottom: 4,
        },
        dayPill: {
          width: 36,
          height: 36,
          borderRadius: 9,
        },
        dayPillText: {
          fontSize: 13.5,
          fontWeight: '800' as const,
        },
        showWeeklyFooter: true,
        weeklyStatsSummaryText: {
          fontSize: 13,
          fontWeight: '700' as const,
        },
      };
    }

    // -------------------------------------------------------------
    // TIER 3 : GRANDS SMARTPHONES MODERNES (screenHeight >= 820 dp)
    // PIXEL 10A EN MODE PLEIN ÉCRAN / PWA / NATIVE, IPHONE MAX, GALAXY ULTRA
    // REMPLISSAGE OPTIMAL DE L'ÉCRAN SANS VIDE ET LISIBILITÉ GYM MAXIMALE
    // -------------------------------------------------------------
    return {
      scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 22,
      },
      topXpCard: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderRadius: 20,
      },
      topUserHeader: {
        marginBottom: 8,
      },
      userGreetingText: {
        fontSize: 24,
        fontWeight: '900' as const,
      },
      userSubDot: {
        fontSize: 15,
      },
      userSubText: {
        fontSize: 16.5,
        fontWeight: '800' as const,
      },
      athleteHeaderBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
      },
      athleteHeaderBadgeText: {
        fontSize: 14.5,
        fontWeight: '900' as const,
      },
      xpTrack: {
        height: 10,
        borderRadius: 5,
        marginBottom: 4,
      },
      xpNumbersText: {
        fontSize: 14,
        fontWeight: '700' as const,
      },
      xpPercentText: {
        fontSize: 14,
        fontWeight: '900' as const,
      },
      activeBanner: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 12,
        minHeight: 56,
        gap: 12,
      },
      prioritySection: {
        marginBottom: 12,
      },
      heroCoachCard: {
        paddingVertical: 18,
        paddingHorizontal: 18,
        marginBottom: 12,
        minHeight: 138,
        gap: 15,
        borderRadius: 20,
      },
      heroCoachIconBox: {
        width: 58,
        height: 58,
        borderRadius: 18,
      },
      heroCoachIconSize: 34,
      heroCoachTitle: {
        fontSize: 24.5,
        fontWeight: '900' as const,
      },
      heroCoachTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
      },
      heroCoachTagText: {
        fontSize: 11.5,
        fontWeight: '900' as const,
      },
      heroCoachSubtitle: {
        fontSize: 15.5,
        marginTop: 3,
      },
      heroCoachActionPill: {
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 13,
      },
      heroCoachActionText: {
        fontSize: 15.5,
        fontWeight: '900' as const,
      },
      rowSpacing: {
        gap: 12,
        marginBottom: 12,
      },
      cardRow: {
        paddingVertical: 16,
        paddingHorizontal: 15,
        gap: 12,
        minHeight: 116,
        borderRadius: 20,
      },
      iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 16,
      },
      cardIconSize: 32,
      cardTitle: {
        fontSize: 21.5,
        fontWeight: '900' as const,
        lineHeight: 26,
      },
      cardSub: {
        fontSize: 14.5,
        fontWeight: '700' as const,
        marginTop: 3,
      },
      weeklyFitnessCard: {
        paddingVertical: 16,
        paddingHorizontal: 18,
        marginBottom: 12,
        borderRadius: 20,
      },
      weeklyFitnessHeader: {
        marginBottom: 10,
      },
      weeklyTitleIconSize: 20,
      weeklyFitnessTitle: {
        fontSize: 20,
        fontWeight: '900' as const,
      },
      weeklyFitnessBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
      },
      weeklyFitnessBadgeText: {
        fontSize: 13.5,
        fontWeight: '900' as const,
      },
      weeklyDaysRow: {
        marginBottom: 8,
      },
      dayPill: {
        width: 40,
        height: 40,
        borderRadius: 11,
      },
      dayPillText: {
        fontSize: 14.5,
        fontWeight: '900' as const,
      },
      showWeeklyFooter: true,
      weeklyStatsSummaryText: {
        fontSize: 14,
        fontWeight: '700' as const,
      },
    };
  }, [isSmallScreen, isMediumScreen]);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [weeklyFitness, setWeeklyFitness] = useState<WeeklyFitnessStats | null>(null);
  const [pokemonStats, setPokemonStats] = useState<{
    incubatingCount: number;
    hatchedCount: number;
    closestEggRemainingXp: number | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // Modal Profil / Nom d'utilisateur
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Modal Badges & Pokémon Hub
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  const { user_name } = useSettingsStore();

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setAuthError('Veuillez saisir un nom d’utilisateur.');
      return;
    }
    if (!passwordInput.trim() || passwordInput.trim().length < 4) {
      setAuthError('Veuillez saisir un mot de passe d’au moins 4 caractères.');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        const res = await loginTrainer(trimmed, passwordInput);
        if (!res.success) {
          setAuthLoading(false);
          setAuthError(res.error || 'Identifiants incorrects');
          return;
        }
      } else {
        const res = await registerTrainer(trimmed, passwordInput);
        if (!res.success) {
          setAuthLoading(false);
          setAuthError(res.error || 'Ce nom d’utilisateur est déjà utilisé.');
          return;
        }
      }

      setAuthLoading(false);
      setNameModalVisible(false);
      setPasswordInput('');
      await loadData();
    } catch (err: any) {
      setAuthLoading(false);
      setAuthError(err?.message || 'Erreur lors de l’authentification.');
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    await logoutTrainer();
    await useSettingsStore.getState().setUserName('');
    setNameInput('');
    setPasswordInput('');
    setIsUserLoggedIn(false);
    setAuthLoading(false);
    setNameModalVisible(false);
    await loadData();
  };

  const {
    isActive,
    programName,
    elapsedSeconds,
    activeSessionXp,
    startFreeWorkout,
  } = useWorkoutSessionStore();

  // Expérience totale dynamique (XP de base + XP acquis en direct pendant la séance en cours)
  const effectiveXp = useMemo(() => {
    const baseXp = levelInfo?.currentXp || 0;
    const live = isActive ? (activeSessionXp || 0) : 0;
    return baseXp + live;
  }, [levelInfo?.currentXp, isActive, activeSessionXp]);

  const effectiveLevelInfo = useMemo(() => {
    return computeLevelInfoForXp(effectiveXp);
  }, [effectiveXp]);

  const favoriteCount = useMemo(() => {
    return Math.max(favoriteExercises.length, favoriteIds.length);
  }, [favoriteExercises.length, favoriteIds.length]);

  const loadData = useCallback(async () => {
    try {
      const [progsRes, gamificationRes, favsRes, favIdsRes, fitnessStatsRes, sessionRes, pendingInvitesRes] =
        await Promise.allSettled([
          getAllPrograms(),
          getUserGamificationStats(),
          getFavoriteExercises(),
          getFavoriteExerciseIds(),
          getWeeklyFitnessStats(),
          getPersistedSession(),
          getPendingFriendRequestsCount(),
        ]);

      if (progsRes.status === 'fulfilled') setPrograms(progsRes.value);
      if (gamificationRes.status === 'fulfilled') {
        const gamification = gamificationRes.value;
        setLevelInfo(gamification.levelInfo);
        const incubating = gamification.incubatingEggs;
        let closestRemaining: number | null = null;
        if (incubating.length > 0) {
          closestRemaining = Math.min(
            ...incubating.map((e) => Math.max(0, e.required_xp - e.current_xp))
          );
        }
        setPokemonStats({
          incubatingCount: incubating.length,
          hatchedCount: gamification.hatchedPokemon.length,
          closestEggRemainingXp: closestRemaining,
        });
      }
      if (favsRes.status === 'fulfilled') setFavoriteExercises(favsRes.value);
      if (favIdsRes.status === 'fulfilled') setFavoriteIds(favIdsRes.value);
      if (fitnessStatsRes.status === 'fulfilled') setWeeklyFitness(fitnessStatsRes.value);
      if (sessionRes.status === 'fulfilled') setIsUserLoggedIn(Boolean(sessionRes.value?.isLoggedIn));
      if (pendingInvitesRes.status === 'fulfilled') setPendingInvitesCount(pendingInvitesRes.value);

      // Si la base locale n'a aucune séance enregistrée cette semaine mais que l'utilisateur a des données cloud, synchroniser silencieusement
      if (fitnessStatsRes.status === 'fulfilled' && fitnessStatsRes.value.weekWorkoutsCount === 0) {
        void (async () => {
          try {
            const { fullCloudSyncToLocal } = await import('../../services/cloudSyncService');
            const syncRes = await fullCloudSyncToLocal();
            if (syncRes.sessionsCount > 0) {
              const [updatedFitness, updatedGStats] = await Promise.all([
                getWeeklyFitnessStats(),
                getUserGamificationStats(),
              ]);
              setWeeklyFitness(updatedFitness);
              setLevelInfo(updatedGStats.levelInfo);
            }
          } catch {}
        })();
      }
    } catch (err) {
      console.error('Erreur chargement accueil:', err);
    }
  }, []);

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

  const handleStartFree = () => {
    startFreeWorkout();
    router.push('/workout/active');
  };


  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, dynamic.scrollContent]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ======================================================== */}
        {/* 1. TOUT EN HAUT : JAUGE D'EXPÉRIENCE, NIVEAU & BADGE      */}
        {/* ======================================================== */}
        <Card style={[styles.topXpCard, dynamic.topXpCard]}>
          <View style={[styles.topUserHeader, dynamic.topUserHeader]}>
            <TouchableOpacity
              style={styles.userNameTouch}
              onPress={async () => {
                const session = await getPersistedSession();
                const loggedIn = Boolean(session?.isLoggedIn);
                setIsUserLoggedIn(loggedIn);
                setNameInput(user_name || '');
                setPasswordInput('');
                setAuthError(null);
                setIsLoginMode(true);
                setNameModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.userGreetingRow}>
                <Text style={[styles.userGreetingText, dynamic.userGreetingText]} numberOfLines={1}>
                  Bonjour {user_name ? user_name : 'l’athlète'} 👋
                </Text>
                <Text style={[styles.userSubDot, dynamic.userSubDot]}>•</Text>
                <Text style={[styles.userSubText, dynamic.userSubText]} numberOfLines={1}>
                  {effectiveLevelInfo?.badgeName || effectiveLevelInfo?.title || 'Athlète'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.athleteHeaderBadge, dynamic.athleteHeaderBadge]}
              onPress={() => setBadgeModalVisible(true)}
              activeOpacity={0.75}
              accessibilityLabel="Ouvrir les Badges et gestion des Pokémon"
            >
              <Text style={[styles.athleteHeaderBadgeText, dynamic.athleteHeaderBadgeText]}>
                {effectiveLevelInfo?.badgeEmoji || '🏅'} Niv. {effectiveLevelInfo?.level || 1}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Jauge d'XP intégrée & élégante */}
          <View style={styles.xpTrackContainer}>
            <View style={[styles.xpTrack, dynamic.xpTrack]}>
              <View
                style={[
                  styles.xpFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(6, effectiveLevelInfo?.progressPercent ?? 0)
                    )}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.xpLabelRow}>
              <Text style={[styles.xpNumbersText, dynamic.xpNumbersText]}>
                {effectiveLevelInfo?.currentXp || 0} / {effectiveLevelInfo?.nextLevelXp || 500} XP
              </Text>
              <Text style={[styles.xpPercentText, dynamic.xpPercentText]}>
                {effectiveLevelInfo?.progressPercent || 0}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Bannière de connexion et synchronisation cloud (si invité non identifié) */}
        {!isUserLoggedIn && (
          <TouchableOpacity
            style={styles.guestSyncBanner}
            onPress={async () => {
              const session = await getPersistedSession();
              const loggedIn = Boolean(session?.isLoggedIn);
              setIsUserLoggedIn(loggedIn);
              setNameInput(user_name || '');
              setPasswordInput('');
              setAuthError(null);
              setIsLoginMode(true);
              setNameModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.guestSyncIconCircle}>
              <Text style={{ fontSize: 18 }}>☁️</Text>
            </View>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={styles.guestSyncTitle}>
                Retrouver mes stats & séances
              </Text>
              <Text style={styles.guestSyncSub}>
                Connectez-vous pour synchroniser votre compte sur cet appareil.
              </Text>
            </View>
            <View style={styles.guestSyncPill}>
              <Text style={styles.guestSyncPillText}>Connexion ❯</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Bannière de séance active PRIORITAIRE (si en cours) */}
        {isActive && (
          <TouchableOpacity
            style={[styles.activeBanner, dynamic.activeBanner]}
            onPress={() => router.push('/workout/active')}
            activeOpacity={0.85}
          >
            <View style={styles.activeBannerContent}>
              <View style={styles.activeBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeBadgeText}>EN COURS</Text>
              </View>
              <Text style={styles.activeTitle} numberOfLines={1}>
                {programName || 'Séance libre'} ({formatElapsed(elapsedSeconds)})
              </Text>
            </View>
            <View style={styles.activeResumePill}>
              <Text style={styles.activeResumeBtnText}>Reprendre ▶</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ======================================================== */}
        {/* 2. LE TRIO PRIORITAIRE (COACH / EXERCICE CIBLÉ / FAVORIS) */}
        {/* ======================================================== */}
        <View style={[styles.prioritySection, dynamic.prioritySection]}>
          {/* CARTE HERO COMPACTE : LANCER LE COACH */}
          <TouchableOpacity
            style={[styles.heroCoachCard, dynamic.heroCoachCard]}
            onPress={() => router.push('/workout/ai-generator')}
            activeOpacity={0.85}
          >
            <View style={[styles.heroCoachIconBox, dynamic.heroCoachIconBox]}>
              <Text style={{ fontSize: dynamic.heroCoachIconSize }}>🤖</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={styles.heroCoachTitleRow}>
                <Text style={[styles.heroCoachTitle, dynamic.heroCoachTitle]}>Lancer le Coach</Text>
                <View style={[styles.heroCoachTag, dynamic.heroCoachTag]}>
                  <Text style={[styles.heroCoachTagText, dynamic.heroCoachTagText]}>IA</Text>
                </View>
              </View>
              <Text style={[styles.heroCoachSubtitle, dynamic.heroCoachSubtitle]} numberOfLines={1}>
                Séance calibrée selon forme & matériel
              </Text>
            </View>
            <View style={[styles.heroCoachActionPill, dynamic.heroCoachActionPill]}>
              <Text style={[styles.heroCoachActionText, dynamic.heroCoachActionText]}>Lancer ▶</Text>
            </View>
          </TouchableOpacity>

          {/* RANGÉE 2 TUILES JUMELLES : EXERCICE CIBLÉ & FAVORIS */}
          <View style={[styles.priorityTwinRow, dynamic.rowSpacing]}>
            {/* TUILE 2 : EXERCICE CIBLÉ */}
            <TouchableOpacity
              style={[styles.priorityTwinCard, styles.targetMuscleCard, dynamic.cardRow]}
              onPress={() => router.push('/programs/target-muscle')}
              activeOpacity={0.85}
            >
              <View style={[styles.priorityTwinIconCircle, dynamic.iconCircle]}>
                <Text style={{ fontSize: dynamic.cardIconSize }}>🎯</Text>
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.priorityTwinTitle, dynamic.cardTitle]} numberOfLines={2}>Exercice Ciblé</Text>
                <Text style={[styles.priorityTwinSub, { color: '#38BDF8' }, dynamic.cardSub]} numberOfLines={1}>Muscle précis</Text>
              </View>
            </TouchableOpacity>

            {/* TUILE 3 : FAVORIS */}
            <TouchableOpacity
              style={[styles.priorityTwinCard, styles.favoritesCard, dynamic.cardRow]}
              onPress={() => router.push('/exercises?filter=favorites')}
              activeOpacity={0.85}
            >
              <View style={[styles.priorityTwinIconCircle, styles.favoritesIconCircle, dynamic.iconCircle]}>
                <Text style={{ fontSize: dynamic.cardIconSize }}>⭐</Text>
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.priorityTwinTitle, dynamic.cardTitle]} numberOfLines={2}>Favoris</Text>
                <Text style={[styles.priorityTwinSub, { color: '#FBBF24' }, dynamic.cardSub]} numberOfLines={1}>
                  {favoriteCount} favori{favoriteCount > 1 ? 's' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3. ACTIONS RAPIDES : SÉANCE LIBRE & MES PROGRAMMES        */}
        {/* ======================================================== */}
        <View style={[styles.secondaryRow, dynamic.rowSpacing]}>
          {/* 1. SÉANCE LIBRE */}
          <TouchableOpacity
            style={[styles.secondaryColCard, dynamic.cardRow]}
            onPress={handleStartFree}
            activeOpacity={0.8}
          >
            <View style={[styles.secondaryIconCircle, dynamic.iconCircle]}>
              <Text style={{ fontSize: dynamic.cardIconSize }}>⚡</Text>
            </View>
            <View style={styles.cardTextCol}>
              <Text style={[styles.secondaryColTitle, dynamic.cardTitle]} numberOfLines={2}>Séance Libre</Text>
              <Text style={[styles.secondaryColSub, { color: Colors.primary }, dynamic.cardSub]} numberOfLines={1}>
                1 Clic • Direct
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. MES PROGRAMMES */}
          <TouchableOpacity
            style={[styles.secondaryColCard, dynamic.cardRow]}
            onPress={() => router.push('/programs')}
            activeOpacity={0.8}
          >
            <View style={[styles.secondaryIconCircle, styles.programIconCircle, dynamic.iconCircle]}>
              <Text style={{ fontSize: dynamic.cardIconSize }}>📂</Text>
            </View>
            <View style={styles.cardTextCol}>
              <Text style={[styles.secondaryColTitle, dynamic.cardTitle]} numberOfLines={2}>Programmes</Text>
              <Text style={[styles.secondaryColSub, { color: '#60A5FA' }, dynamic.cardSub]} numberOfLines={1}>
                {programs.length} disponible{programs.length > 1 ? 's' : ''}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* 4. RANGÉE 3 : ARÈNE & FORME SEMAINE                      */}
        {/* ======================================================== */}
        <View style={[styles.secondaryRow, dynamic.rowSpacing]}>
          {/* ARÈNE */}
          <TouchableOpacity
            style={[styles.secondaryColCard, styles.arenaCard, dynamic.cardRow]}
            onPress={() => router.push('/arena')}
            activeOpacity={0.8}
          >
            <View style={[styles.secondaryIconCircle, styles.arenaIconCircle, dynamic.iconCircle]}>
              <Text style={{ fontSize: dynamic.cardIconSize }}>⚔️</Text>
              {pendingInvitesCount > 0 && (
                <View style={styles.arenaBadgePulse}>
                  <Text style={styles.arenaBadgePulseText}>{pendingInvitesCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardTextCol}>
              <Text style={[styles.secondaryColTitle, dynamic.cardTitle]} numberOfLines={1}>Arène</Text>
              <Text
                style={[
                  styles.secondaryColSub,
                  { color: pendingInvitesCount > 0 ? '#F87171' : '#C084FC' },
                  dynamic.cardSub,
                ]}
                numberOfLines={1}
              >
                {pendingInvitesCount > 0 ? `🔔 ${pendingInvitesCount} invit.` : 'Ligue & Défis'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* FORME SEMAINE */}
          <TouchableOpacity
            style={[styles.secondaryColCard, styles.weeklyFitnessCompactCard, dynamic.cardRow]}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.8}
            accessibilityLabel="Forme de la semaine"
          >
            <View style={[styles.secondaryIconCircle, styles.fitnessIconCircle, dynamic.iconCircle]}>
              <Text style={{ fontSize: dynamic.cardIconSize }}>🔥</Text>
            </View>
            <View style={styles.cardTextCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.secondaryColTitle, dynamic.cardTitle]} numberOfLines={1}>Forme</Text>
                <Text
                  style={[
                    styles.weeklyCompactBadgeText,
                    {
                      color:
                        (weeklyFitness?.fitnessScorePercent || 0) >= 75
                          ? '#34D399'
                          : Colors.primary,
                    },
                  ]}
                >
                  {weeklyFitness?.fitnessScorePercent || 0}%
                </Text>
              </View>
              {/* Mini barre de progression dynamique Forme */}
              <View style={styles.weeklyFitnessMiniTrack}>
                <View
                  style={[
                    styles.weeklyFitnessMiniFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max((weeklyFitness?.fitnessScorePercent || 0) > 0 ? 8 : 0, weeklyFitness?.fitnessScorePercent || 0)
                      )}%`,
                      backgroundColor:
                        (weeklyFitness?.fitnessScorePercent || 0) >= 75
                          ? '#10B981'
                          : (weeklyFitness?.fitnessScorePercent || 0) >= 25
                          ? Colors.primary
                          : '#F59E0B',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.secondaryColSub, { color: '#34D399' }, dynamic.cardSub]} numberOfLines={1}>
                {weeklyFitness?.weekWorkoutsCount || 0}/{weeklyFitness?.targetWeeklyWorkouts || 4} séances
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL : BADGES & GESTION DES POKÉMONS                    */}
      {/* ======================================================== */}
      <Modal
        visible={badgeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBadgeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.badgeModalCard}>
            {/* Header du modal */}
            <View style={styles.badgeModalHeader}>
              <View style={styles.badgeModalIconBox}>
                <Text style={{ fontSize: 32 }}>{effectiveLevelInfo?.badgeEmoji || '🏅'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeModalTitle}>
                  {effectiveLevelInfo?.badgeName || 'Badge Roche'}
                </Text>
                <Text style={styles.badgeModalSubtitle}>
                  Niveau {effectiveLevelInfo?.level || 1} • {effectiveLevelInfo?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setBadgeModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Informations de palier */}
            <View style={styles.badgeModalStatsRow}>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>{effectiveLevelInfo?.currentXp || 0}</Text>
                <Text style={styles.badgeModalStatLabel}>XP Cumulés</Text>
              </View>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>
                  {pokemonStats?.hatchedCount || 0}
                </Text>
                <Text style={styles.badgeModalStatLabel}>Pokémon Éclos</Text>
              </View>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>
                  {pokemonStats?.incubatingCount || 0}
                </Text>
                <Text style={styles.badgeModalStatLabel}>En Incubation</Text>
              </View>
            </View>

            {/* Défilement des 8 Badges de Kanto */}
            <Text style={styles.kantoBadgesTitle}>
              🏛️ Les 8 Badges de Kanto & Ligue
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kantoBadgesScroll}
            >
              {POKEMON_BADGE_TIERS.map((tier) => {
                const isUnlocked = (effectiveLevelInfo?.currentXp ?? 0) >= tier.minXp;
                const isCurrent = effectiveLevelInfo?.level === tier.level;

                return (
                  <TouchableOpacity
                    key={tier.level}
                    style={[
                      styles.kantoBadgeItem,
                      isCurrent && styles.kantoBadgeCurrent,
                      !isUnlocked && styles.kantoBadgeLocked,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      const currentTotalXp = effectiveLevelInfo?.currentXp ?? 0;
                      const remaining = Math.max(0, tier.minXp - currentTotalXp);
                      Alert.alert(
                        `${tier.emoji} ${tier.badgeName}`,
                        `${tier.description}\n\n` +
                        `🏛️ Arène : ${tier.city} (${tier.champion}) • ${tier.type}\n` +
                        `⚡ Palier : ${tier.minXp} XP\n\n` +
                        (isUnlocked
                          ? '✓ Badge débloqué et conquis !'
                          : `🔒 Verrouillé : plus que ${remaining} XP d’entraînement pour le remporter !`),
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.kantoBadgeEmoji,
                        !isUnlocked && { opacity: 0.3 },
                      ]}
                    >
                      {tier.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.kantoBadgeName,
                        isCurrent && { color: Colors.primary, fontWeight: '800' },
                        !isUnlocked && { color: Colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {tier.badgeName}
                    </Text>
                    <Text style={styles.kantoBadgeXp}>{tier.minXp} XP</Text>
                    {isCurrent && (
                      <View style={styles.currentBadgeTag}>
                        <Text style={styles.currentBadgeTagText}>ACTUEL</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {pokemonStats?.closestEggRemainingXp !== null && (
              <View style={styles.modalIncubatorHint}>
                <Text style={styles.modalIncubatorHintText}>
                  🥚 Prochain œuf : plus que {pokemonStats?.closestEggRemainingXp} XP d’effort !
                </Text>
              </View>
            )}

            {/* Raccourcis directs vers la gestion */}
            <View style={styles.badgeModalActions}>
              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/(tabs)/history?tab=pokemon');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>🥚</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Incubateurs & Pokédex
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Gérer vos œufs, éclosions et collection
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/(tabs)/history?tab=achievements');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Trophées & Exploits
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Consulter vos défis d’athlète et hauts faits
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/arena');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>⚔️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Arène & Échanges
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Combattre en ligue, échanger des Pokémon et défier le Raid Boss
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL : SAISIE DU PSEUDO / COMPTE                        */}
      {/* ======================================================== */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.nameModalCard}>
            <View style={styles.nameModalHeader}>
              <View style={styles.nameModalIconCircle}>
                <Text style={{ fontSize: 28 }}>🏆</Text>
              </View>
              <Text style={styles.nameModalTitle}>
                {isUserLoggedIn
                  ? 'Compte Athlète'
                  : isLoginMode
                  ? 'Connexion Athlète'
                  : 'Créer un Compte Athlète'}
              </Text>
              <Text style={styles.nameModalSubtitle}>
                {isUserLoggedIn
                  ? 'Vos données et classements sont synchronisés avec le cloud.'
                  : isLoginMode
                  ? 'Connectez-vous pour récupérer vos séances, Pokémon et XP.'
                  : 'Renseignez un pseudo et un mot de passe pour sauvegarder vos données.'}
              </Text>
            </View>

            {authError && (
              <View style={styles.authErrorBox}>
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            )}

            {isUserLoggedIn ? (
              <View>
                <View style={styles.loggedInProfileBox}>
                  <Text style={styles.loggedInBadge}>✓ Compte Connecté</Text>
                  <Text style={styles.loggedInUsername}>{user_name}</Text>
                  <Text style={styles.loggedInSubtitle}>
                    {levelInfo?.badgeName ? levelInfo.badgeName : 'Athlète'} • {levelInfo?.currentXp || 0} XP
                  </Text>
                </View>

                <View style={styles.nameModalButtons}>
                  <Button
                    title="Se déconnecter"
                    variant="danger"
                    size="md"
                    onPress={handleLogout}
                    loading={authLoading}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Fermer"
                    variant="outline"
                    size="md"
                    onPress={() => setNameModalVisible(false)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <View>
                {/* Sélecteur d'onglets explicite Connexion / Création */}
                <View style={styles.authTabsRow}>
                  <TouchableOpacity
                    style={[styles.authTab, isLoginMode && styles.authTabActive]}
                    onPress={() => {
                      setIsLoginMode(true);
                      setAuthError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.authTabText, isLoginMode && styles.authTabTextActive]}
                    >
                      🔑 Se connecter
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.authTab, !isLoginMode && styles.authTabActive]}
                    onPress={() => {
                      setIsLoginMode(false);
                      setAuthError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.authTabText, !isLoginMode && styles.authTabTextActive]}
                    >
                      👤 Créer un compte
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputFieldLabel}>Nom d’utilisateur (Pseudo)</Text>
                <TextInput
                  style={styles.nameModalInput}
                  placeholder="Ex: Matthieu, Sarah, Lucas..."
                  placeholderTextColor={Colors.textMuted}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  maxLength={25}
                  returnKeyType="next"
                />

                <Text style={styles.inputFieldLabel}>Mot de passe</Text>
                <TextInput
                  style={styles.nameModalInput}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />

                <View style={styles.persistentLoginNote}>
                  <Text style={styles.persistentLoginNoteText}>
                    🔒 Vos données seront automatiquement sauvegardées et synchronisées entre le Web et l’application mobile.
                  </Text>
                </View>

                <View style={styles.nameModalButtons}>
                  <Button
                    title="Annuler"
                    variant="outline"
                    size="md"
                    onPress={() => {
                      setNameModalVisible(false);
                      setPasswordInput('');
                      setAuthError(null);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={
                      authLoading
                        ? 'Validation...'
                        : isLoginMode
                        ? 'Se connecter'
                        : 'Créer mon compte'
                    }
                    variant="primary"
                    size="md"
                    onPress={handleSaveName}
                    disabled={authLoading}
                    loading={authLoading}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  guestSyncBanner: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestSyncIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestSyncTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  guestSyncSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  guestSyncPill: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  guestSyncPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  topXpCard: {
    backgroundColor: '#0F1626',
    borderWidth: 1.5,
    borderColor: '#20304C',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  topUserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userNameTouch: {
    flex: 1,
  },
  userGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userGreetingText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  userSubDot: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  userSubText: {
    fontSize: 15.5,
    color: Colors.primary,
    fontWeight: '800',
  },
  athleteHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162235',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3C58',
  },
  athleteHeaderBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FBBF24',
  },
  xpGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FBBF24',
  },
  xpTrackContainer: {
    flex: 1,
  },
  xpTrack: {
    height: 10,
    backgroundColor: '#080D14',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpNumbersText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  xpPercentText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
  },
  endBadgeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A2338',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBadgeEmoji: {
    fontSize: 22,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23150A',
    borderColor: Colors.primary,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 10,
    minHeight: 56,
  },
  activeBannerContent: {
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  activeResumePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  activeResumeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryText,
  },

  /* ======================================================== */
  /* TRIO PRIORITAIRE COMPACT                                 */
  /* ======================================================== */
  prioritySection: {
    marginBottom: 12,
  },
  heroCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 14,
    minHeight: 124,
  },
  heroCoachIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 85, 0, 0.4)',
  },
  heroCoachTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCoachTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroCoachTag: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  heroCoachTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.accent,
  },
  heroCoachSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14.5,
    marginTop: 3,
  },
  heroCoachActionPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  heroCoachActionText: {
    color: Colors.primaryText,
    fontSize: 14.5,
    fontWeight: '900',
  },
  priorityTwinRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityTwinCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 11,
    minHeight: 104,
  },
  targetMuscleCard: {
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: '#111827',
  },
  favoritesCard: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#111827',
  },
  priorityTwinIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritesIconCircle: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  cardTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  priorityTwinTitle: {
    color: '#FFFFFF',
    fontSize: 18.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  priorityTwinSub: {
    color: Colors.textMuted,
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
  },
  priorityTwinArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  /* ======================================================== */
  /* ACTIONS RAPIDES : SÉANCE LIBRE & MES PROGRAMMES          */
  /* ======================================================== */
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  secondaryColCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 11,
    minHeight: 104,
  },
  secondaryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programIconCircle: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  secondaryColTitle: {
    color: '#FFFFFF',
    fontSize: 18.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  secondaryColSub: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
  },
  secondaryArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  arenaCard: {
    borderColor: 'rgba(139, 92, 246, 0.35)',
    backgroundColor: '#111827',
  },
  arenaIconCircle: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
  },
  progressCard: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: '#111827',
  },
  progressIconCircle: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  weeklyFitnessCompactCard: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: '#111827',
  },
  fitnessIconCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  weeklyCompactBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    marginRight: 4,
  },
  weeklyFitnessMiniTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    marginVertical: 4,
    overflow: 'hidden',
  },
  weeklyFitnessMiniFill: {
    height: '100%',
    borderRadius: 3,
  },
  modalIncubatorHint: {
    backgroundColor: '#162235',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#25354E',
  },
  modalIncubatorHintText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* ======================================================== */
  /* JAUGE DE FORME HEBDOMADAIRE                              */
  /* ======================================================== */
  weeklyFitnessCard: {
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  weeklyFitnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyFitnessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weeklyFitnessTitle: {
    fontSize: 18.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  weeklyFitnessSubInfo: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '700',
    marginLeft: 3,
  },
  weeklyFitnessBadge: {
    backgroundColor: 'rgba(255, 90, 31, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  weeklyFitnessBadgeHigh: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  weeklyFitnessBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FF8A50',
  },
  weeklyFitnessBadgeTextHigh: {
    color: '#34D399',
  },
  weeklyTrackContainer: {
    marginBottom: 10,
  },
  weeklyTrack: {
    height: 8,
    backgroundColor: '#080E18',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A293E',
  },
  weeklyTrackFill: {
    height: '100%',
    borderRadius: 5,
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#141E30',
    borderWidth: 1,
    borderColor: '#22334D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  dayPillToday: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  dayPillTextActive: {
    color: Colors.primaryText,
    fontWeight: '900',
  },
  dayPillTextToday: {
    color: '#FBBF24',
  },
  weeklyFitnessFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1A283D',
    paddingTop: 8,
    gap: 3,
  },
  weeklyStatsSummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#93C5FD',
  },
  weeklyMotivationQuote: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  badgeModalCard: {
    backgroundColor: '#111A29',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#24344D',
    maxHeight: '90%',
  },
  badgeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badgeModalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1E2C42',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  badgeModalSubtitle: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  closeModalText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: 'bold',
  },
  badgeModalStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#090E17',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 16,
  },
  badgeModalStat: {
    flex: 1,
    alignItems: 'center',
  },
  badgeModalStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 2,
  },
  badgeModalStatLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  kantoBadgesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  kantoBadgesScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  kantoBadgeItem: {
    width: 90,
    backgroundColor: '#0E1624',
    borderWidth: 1,
    borderColor: '#1E2C42',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  kantoBadgeCurrent: {
    borderColor: '#F59E0B',
    backgroundColor: '#1A2338',
  },
  kantoBadgeLocked: {
    opacity: 0.5,
  },
  kantoBadgeEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  kantoBadgeName: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  kantoBadgeXp: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  currentBadgeTag: {
    backgroundColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 4,
  },
  currentBadgeTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#090E17',
  },
  badgeModalActions: {
    gap: 8,
    marginTop: 4,
  },
  badgeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1624',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C42',
    gap: 12,
  },
  badgeActionBtnIcon: {
    fontSize: 24,
  },
  badgeActionBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  badgeActionBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  badgeActionBtnArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  nameModalCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  nameModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  nameModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  nameModalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  authErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  authErrorText: {
    color: '#F87171',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  nameModalInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#2D3748',
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  persistentLoginNote: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  persistentLoginNoteText: {
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 15,
  },
  authToggleModeBtn: {
    paddingVertical: 6,
    marginBottom: 14,
    alignItems: 'center',
  },
  authToggleModeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  nameModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  authTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0D1117',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  authTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  authTabActive: {
    backgroundColor: Colors.primary,
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  authTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loggedInProfileBox: {
    backgroundColor: '#0D1117',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  loggedInBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
  },
  loggedInUsername: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  loggedInSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  arenaBadgePulse: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0F1626',
  },
  arenaBadgePulseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
