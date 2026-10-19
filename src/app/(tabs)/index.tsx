import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  LayoutChangeEvent,
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
import { UserAvatar } from '../../components/common/UserAvatar';
import { AvatarPickerModal } from '../../components/common/AvatarPickerModal';
import {
  getUserGamificationStats,
  LevelInfo,
  ATHLETE_RANK_TIERS,
  computeLevelInfoForXp,
} from '../../services/gamificationService';
import { getFavoriteExercises, getFavoriteExerciseIds } from '../../services/favoritesService';
import { registerTrainer, loginTrainer, logoutTrainer, getPersistedSession } from '../../services/authService';
import { getPendingFriendRequestsCount, getOrCreateTrainerProfile } from '../../services/multiplayerService';
import { isProgramCompatibleByEquipmentString } from '../../utils/exerciseUnits';
import { showAlert } from '../../utils/alert';
import seedData from '../../database/seedData.json';

export default function HomeScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState<number>(0);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0 && Math.abs(h - containerHeight) > 1) {
      setContainerHeight(h);
    }
  }, [containerHeight]);

  // Hauteur exploitable pour la page d'accueil entre le header (~54dp) et la barre d'onglets (~76dp)
  const fallbackHeight = Math.max(480, screenHeight - 130);
  const effectiveHeight = containerHeight > 0 ? containerHeight : fallbackHeight;

  const isCompactHeight = effectiveHeight < 580;
  const isMediumHeight = effectiveHeight >= 580 && effectiveHeight < 680;
  const isLargeHeight = effectiveHeight >= 680 && effectiveHeight < 780;
  // Tier 4 implicite : effectiveHeight >= 780 (grands smartphones et formats allongés)

  const dynamic = useMemo(() => {
    // -------------------------------------------------------------
    // TIER 1 : PETITS ÉCRANS (< 580 dp utilisables, ex: iPhone SE)
    // -------------------------------------------------------------
    if (isCompactHeight) {
      return {
        scrollContent: {
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 8,
        },
        topXpCard: {
          paddingVertical: 7,
          paddingHorizontal: 10,
          marginBottom: 6,
          borderRadius: 12,
        },
        topUserHeader: {
          marginBottom: 4,
        },
        userGreetingText: {
          fontSize: 16,
          fontWeight: '900' as const,
        },
        userSubDot: {
          fontSize: 11,
        },
        userSubText: {
          fontSize: 12,
          fontWeight: '800' as const,
        },
        athleteHeaderBadge: {
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 7,
        },
        athleteHeaderBadgeText: {
          fontSize: 11,
          fontWeight: '900' as const,
        },
        xpTrack: {
          height: 5,
          borderRadius: 3,
          marginBottom: 2,
        },
        xpNumbersText: {
          fontSize: 10.5,
          fontWeight: '700' as const,
        },
        xpPercentText: {
          fontSize: 10.5,
          fontWeight: '900' as const,
        },
        activeBanner: {
          paddingVertical: 6,
          paddingHorizontal: 8,
          marginBottom: 6,
          minHeight: 40,
          gap: 6,
        },
        tilesContainer: {
          flex: 1,
          justifyContent: 'space-between' as const,
          gap: 6,
          marginBottom: 6,
        },
        prioritySection: {
          marginBottom: 0,
        },
        heroCoachCard: {
          flex: 1.15,
          minHeight: 64,
          maxHeight: 95,
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 0,
          gap: 8,
          borderRadius: 13,
        },
        heroCoachIconBox: {
          width: 38,
          height: 38,
          borderRadius: 10,
        },
        heroCoachIconSize: 22,
        heroCoachTitle: {
          fontSize: 16,
          fontWeight: '900' as const,
        },
        heroCoachTag: {
          paddingHorizontal: 4,
          paddingVertical: 1,
        },
        heroCoachTagText: {
          fontSize: 9,
          fontWeight: '900' as const,
        },
        heroCoachSubtitle: {
          fontSize: 11.5,
          marginTop: 1,
        },
        heroCoachActionPill: {
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 8,
        },
        heroCoachActionText: {
          fontSize: 12,
          fontWeight: '900' as const,
        },
        rowSpacing: {
          flex: 1,
          flexDirection: 'row' as const,
          gap: 6,
          marginBottom: 0,
        },
        cardRow: {
          flex: 1,
          height: '100%' as const,
          minHeight: 56,
          maxHeight: 85,
          paddingVertical: 6,
          paddingHorizontal: 8,
          gap: 7,
          borderRadius: 13,
        },
        iconCircle: {
          width: 34,
          height: 34,
          borderRadius: 10,
        },
        cardIconSize: 18,
        cardTitle: {
          fontSize: 13.5,
          fontWeight: '900' as const,
          lineHeight: 16,
        },
        cardSub: {
          fontSize: 10.5,
          fontWeight: '700' as const,
          marginTop: 1,
        },
        weeklyFitnessCard: {
          paddingVertical: 7,
          paddingHorizontal: 10,
          marginBottom: 2,
          borderRadius: 12,
        },
        weeklyFitnessHeader: {
          marginBottom: 4,
        },
        weeklyTitleIconSize: 14,
        weeklyFitnessTitle: {
          fontSize: 14.5,
          fontWeight: '900' as const,
        },
        weeklyFitnessBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
        },
        weeklyFitnessBadgeText: {
          fontSize: 11,
          fontWeight: '800' as const,
        },
        weeklyDaysRow: {
          marginBottom: 2,
        },
        dayPill: {
          width: 26,
          height: 26,
          borderRadius: 6,
        },
        dayPillText: {
          fontSize: 10,
          fontWeight: '800' as const,
        },
        showWeeklyFooter: false,
        weeklyStatsSummaryText: {
          fontSize: 11,
          fontWeight: '700' as const,
        },
      };
    }

    // -------------------------------------------------------------
    // TIER 2 : ÉCRANS STANDARDS (580 <= effectiveHeight < 680 dp)
    // EX: PIXEL, GALAXY, IPHONE EN NAVIGATEUR MOBILE
    // -------------------------------------------------------------
    if (isMediumHeight) {
      return {
        scrollContent: {
          paddingHorizontal: 14,
          paddingTop: 7,
          paddingBottom: 10,
        },
        topXpCard: {
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginBottom: 7,
          borderRadius: 14,
        },
        topUserHeader: {
          marginBottom: 5,
        },
        userGreetingText: {
          fontSize: 18,
          fontWeight: '900' as const,
        },
        userSubDot: {
          fontSize: 12,
        },
        userSubText: {
          fontSize: 13.5,
          fontWeight: '800' as const,
        },
        athleteHeaderBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
        },
        athleteHeaderBadgeText: {
          fontSize: 12,
          fontWeight: '900' as const,
        },
        xpTrack: {
          height: 6,
          borderRadius: 3,
          marginBottom: 2,
        },
        xpNumbersText: {
          fontSize: 11.5,
          fontWeight: '700' as const,
        },
        xpPercentText: {
          fontSize: 11.5,
          fontWeight: '900' as const,
        },
        activeBanner: {
          paddingVertical: 7,
          paddingHorizontal: 10,
          marginBottom: 7,
          minHeight: 44,
          gap: 7,
        },
        tilesContainer: {
          flex: 1,
          justifyContent: 'space-between' as const,
          gap: 7,
          marginBottom: 7,
        },
        prioritySection: {
          marginBottom: 0,
        },
        heroCoachCard: {
          flex: 1.15,
          minHeight: 74,
          maxHeight: 115,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 0,
          gap: 10,
          borderRadius: 15,
        },
        heroCoachIconBox: {
          width: 44,
          height: 44,
          borderRadius: 12,
        },
        heroCoachIconSize: 25,
        heroCoachTitle: {
          fontSize: 18,
          fontWeight: '900' as const,
        },
        heroCoachTag: {
          paddingHorizontal: 5,
          paddingVertical: 1.5,
        },
        heroCoachTagText: {
          fontSize: 10,
          fontWeight: '900' as const,
        },
        heroCoachSubtitle: {
          fontSize: 12.5,
          marginTop: 1,
        },
        heroCoachActionPill: {
          paddingHorizontal: 11,
          paddingVertical: 6,
          borderRadius: 9,
        },
        heroCoachActionText: {
          fontSize: 13,
          fontWeight: '900' as const,
        },
        rowSpacing: {
          flex: 1,
          flexDirection: 'row' as const,
          gap: 7,
          marginBottom: 0,
        },
        cardRow: {
          flex: 1,
          height: '100%' as const,
          minHeight: 66,
          maxHeight: 105,
          paddingVertical: 8,
          paddingHorizontal: 10,
          gap: 8,
          borderRadius: 15,
        },
        iconCircle: {
          width: 38,
          height: 38,
          borderRadius: 11,
        },
        cardIconSize: 20,
        cardTitle: {
          fontSize: 15,
          fontWeight: '900' as const,
          lineHeight: 18,
        },
        cardSub: {
          fontSize: 11.5,
          fontWeight: '700' as const,
          marginTop: 1,
        },
        weeklyFitnessCard: {
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginBottom: 4,
          borderRadius: 14,
        },
        weeklyFitnessHeader: {
          marginBottom: 5,
        },
        weeklyTitleIconSize: 15,
        weeklyFitnessTitle: {
          fontSize: 16,
          fontWeight: '900' as const,
        },
        weeklyFitnessBadge: {
          paddingHorizontal: 7,
          paddingVertical: 2.5,
          borderRadius: 9999,
        },
        weeklyFitnessBadgeText: {
          fontSize: 12,
          fontWeight: '800' as const,
        },
        weeklyDaysRow: {
          marginBottom: 3,
        },
        dayPill: {
          width: 30,
          height: 30,
          borderRadius: 15,
        },
        dayPillText: {
          fontSize: 11,
          fontWeight: '800' as const,
        },
        showWeeklyFooter: true,
        weeklyStatsSummaryText: {
          fontSize: 11.5,
          fontWeight: '700' as const,
        },
      };
    }

    // -------------------------------------------------------------
    // TIER 3 : GRANDS SMARTPHONES MODERNES (680 <= effectiveHeight < 780 dp)
    // EX: PIXEL EN PLEIN ÉCRAN, IPHONE 14/15/16, S23/S24
    // -------------------------------------------------------------
    if (isLargeHeight) {
      return {
        scrollContent: {
          paddingHorizontal: 15,
          paddingTop: 8,
          paddingBottom: 12,
        },
        topXpCard: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 8,
          borderRadius: 16,
        },
        topUserHeader: {
          marginBottom: 6,
        },
        userGreetingText: {
          fontSize: 19.5,
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
          paddingHorizontal: 9,
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
          fontSize: 12,
          fontWeight: '700' as const,
        },
        xpPercentText: {
          fontSize: 12,
          fontWeight: '900' as const,
        },
        activeBanner: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginBottom: 8,
          minHeight: 48,
          gap: 8,
        },
        tilesContainer: {
          flex: 1,
          justifyContent: 'space-between' as const,
          gap: 8,
          marginBottom: 8,
        },
        prioritySection: {
          marginBottom: 0,
        },
        heroCoachCard: {
          flex: 1.15,
          minHeight: 84,
          maxHeight: 135,
          paddingVertical: 11,
          paddingHorizontal: 14,
          marginBottom: 0,
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
          fontSize: 19.5,
          fontWeight: '900' as const,
        },
        heroCoachTag: {
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        heroCoachTagText: {
          fontSize: 10.5,
          fontWeight: '900' as const,
        },
        heroCoachSubtitle: {
          fontSize: 13,
          marginTop: 2,
        },
        heroCoachActionPill: {
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: 10,
        },
        heroCoachActionText: {
          fontSize: 13.5,
          fontWeight: '900' as const,
        },
        rowSpacing: {
          flex: 1,
          flexDirection: 'row' as const,
          gap: 8,
          marginBottom: 0,
        },
        cardRow: {
          flex: 1,
          height: '100%' as const,
          minHeight: 76,
          maxHeight: 120,
          paddingVertical: 10,
          paddingHorizontal: 12,
          gap: 9,
          borderRadius: 16,
        },
        iconCircle: {
          width: 42,
          height: 42,
          borderRadius: 13,
        },
        cardIconSize: 23,
        cardTitle: {
          fontSize: 16,
          fontWeight: '900' as const,
          lineHeight: 19,
        },
        cardSub: {
          fontSize: 12,
          fontWeight: '700' as const,
          marginTop: 2,
        },
        weeklyFitnessCard: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 6,
          borderRadius: 16,
        },
        weeklyFitnessHeader: {
          marginBottom: 6,
        },
        weeklyTitleIconSize: 16,
        weeklyFitnessTitle: {
          fontSize: 17,
          fontWeight: '900' as const,
        },
        weeklyFitnessBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 9999,
        },
        weeklyFitnessBadgeText: {
          fontSize: 12.5,
          fontWeight: '800' as const,
        },
        weeklyDaysRow: {
          marginBottom: 4,
        },
        dayPill: {
          width: 32,
          height: 32,
          borderRadius: 16,
        },
        dayPillText: {
          fontSize: 11.5,
          fontWeight: '800' as const,
        },
        showWeeklyFooter: true,
        weeklyStatsSummaryText: {
          fontSize: 12,
          fontWeight: '700' as const,
        },
      };
    }

    // -------------------------------------------------------------
    // TIER 4 : TRÈS GRANDS SMARTPHONES & FORMATS ALLONGÉS (effectiveHeight >= 780 dp)
    // EX: IPHONE PRO MAX, S24 ULTRA, PIXEL PRO, ÉCRANS 20:9 OU TABLETTES
    // -------------------------------------------------------------
    return {
      scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
      },
      topXpCard: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 10,
        borderRadius: 18,
      },
      topUserHeader: {
        marginBottom: 6,
      },
      userGreetingText: {
        fontSize: 21,
        fontWeight: '900' as const,
      },
      userSubDot: {
        fontSize: 13,
      },
      userSubText: {
        fontSize: 14.5,
        fontWeight: '800' as const,
      },
      athleteHeaderBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4.5,
        borderRadius: 10,
      },
      athleteHeaderBadgeText: {
        fontSize: 13.5,
        fontWeight: '900' as const,
      },
      xpTrack: {
        height: 8,
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
        paddingVertical: 9,
        paddingHorizontal: 13,
        marginBottom: 9,
        minHeight: 50,
        gap: 9,
      },
      tilesContainer: {
        flex: 1,
        justifyContent: 'space-between' as const,
        gap: 10,
        marginBottom: 10,
      },
      prioritySection: {
        marginBottom: 0,
      },
      heroCoachCard: {
        flex: 1.15,
        minHeight: 94,
        maxHeight: 150,
        paddingVertical: 13,
        paddingHorizontal: 16,
        marginBottom: 0,
        gap: 14,
        borderRadius: 18,
      },
      heroCoachIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
      },
      heroCoachIconSize: 30,
      heroCoachTitle: {
        fontSize: 21,
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
        fontSize: 14,
        marginTop: 2,
      },
      heroCoachActionPill: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 11,
      },
      heroCoachActionText: {
        fontSize: 14,
        fontWeight: '900' as const,
      },
      rowSpacing: {
        flex: 1,
        flexDirection: 'row' as const,
        gap: 10,
        marginBottom: 0,
      },
      cardRow: {
        flex: 1,
        height: '100%' as const,
        minHeight: 84,
        maxHeight: 135,
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 10,
        borderRadius: 18,
      },
      iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 14,
      },
      cardIconSize: 25,
      cardTitle: {
        fontSize: 17,
        fontWeight: '900' as const,
        lineHeight: 21,
      },
      cardSub: {
        fontSize: 13,
        fontWeight: '700' as const,
        marginTop: 2,
      },
      weeklyFitnessCard: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: 18,
      },
      weeklyFitnessHeader: {
        marginBottom: 7,
      },
      weeklyTitleIconSize: 17,
      weeklyFitnessTitle: {
        fontSize: 18,
        fontWeight: '900' as const,
      },
      weeklyFitnessBadge: {
        paddingHorizontal: 9,
        paddingVertical: 3.5,
        borderRadius: 9999,
      },
      weeklyFitnessBadgeText: {
        fontSize: 13,
        fontWeight: '800' as const,
      },
      weeklyDaysRow: {
        marginBottom: 5,
      },
      dayPill: {
        width: 34,
        height: 34,
        borderRadius: 17,
      },
      dayPillText: {
        fontSize: 12,
        fontWeight: '800' as const,
      },
      showWeeklyFooter: true,
      weeklyStatsSummaryText: {
        fontSize: 12.5,
        fontWeight: '700' as const,
      },
    };
  }, [isCompactHeight, isMediumHeight, isLargeHeight]);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [weeklyFitness, setWeeklyFitness] = useState<WeeklyFitnessStats | null>(null);
  const [achievementsStats, setAchievementsStats] = useState<{
    unlockedCount: number;
    totalCount: number;
    totalSessions: number;
  }>({ unlockedCount: 0, totalCount: 0, totalSessions: 0 });
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

  // Modal Rangs & Trophées
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const { user_name, avatar_url, setAvatarUrl, available_equipments, filter_by_available_equipment } = useSettingsStore();

  const compatibleProgramsCount = useMemo(() => {
    if (!filter_by_available_equipment) return programs.length;
    return programs.filter((p) =>
      isProgramCompatibleByEquipmentString(p, available_equipments)
    ).length;
  }, [programs, filter_by_available_equipment, available_equipments]);

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
      const [progsRes, gamificationRes, favsRes, favIdsRes, fitnessStatsRes, sessionRes, pendingInvitesRes, profileRes] =
        await Promise.allSettled([
          getAllPrograms(),
          getUserGamificationStats(),
          getFavoriteExercises(),
          getFavoriteExerciseIds(),
          getWeeklyFitnessStats(),
          getPersistedSession(),
          getPendingFriendRequestsCount(),
          getOrCreateTrainerProfile(),
        ]);

      if (progsRes.status === 'fulfilled') setPrograms(progsRes.value);
      if (gamificationRes.status === 'fulfilled') {
        const gamification = gamificationRes.value;
        let finalLevel = gamification.levelInfo;
        if (profileRes.status === 'fulfilled' && profileRes.value?.totalXp) {
          if (profileRes.value.totalXp > (gamification.totalXp || 0)) {
            finalLevel = computeLevelInfoForXp(profileRes.value.totalXp);
          }
        }
        setLevelInfo(finalLevel);
        setAchievementsStats({
          unlockedCount: gamification.achievements.filter((a) => a.unlocked).length,
          totalCount: gamification.achievements.length,
          totalSessions: gamification.totalSessions,
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
    if (isActive) {
      showAlert(
        'Séance déjà en cours ⚡',
        `La séance « ${programName || 'Séance libre'} » est actuellement en cours. Voulez-vous la remplacer par une nouvelle séance libre ?`,
        [
          {
            text: 'Reprendre en cours',
            style: 'cancel',
            onPress: () => router.push('/workout/active'),
          },
          {
            text: 'Nouvelle séance',
            style: 'destructive',
            onPress: () => {
              startFreeWorkout();
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    startFreeWorkout();
    router.push('/workout/active');
  };


  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          dynamic.scrollContent,
          {
            minHeight: effectiveHeight > 0 ? effectiveHeight : '100%',
          },
        ]}
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
            <View style={styles.userNameTouch}>
              <View style={styles.userGreetingRow}>
                <UserAvatar
                  avatarUrl={avatar_url}
                  fallbackEmoji={effectiveLevelInfo?.badgeEmoji || '👤'}
                  size={32}
                  style={{ borderWidth: 1, borderColor: '#38BDF8' }}
                  userName={user_name || "L'athlète"}
                  userSubtitle={effectiveLevelInfo?.badgeName || effectiveLevelInfo?.title || 'Athlète'}
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
                  onEditPress={() => {
                    setNameModalVisible(true);
                    setAvatarPickerVisible(true);
                  }}
                  enableEnlarge
                />
                <TouchableOpacity
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
                  style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}
                >
                  <Text style={[styles.userGreetingText, dynamic.userGreetingText]} numberOfLines={1}>
                    Bonjour {user_name ? user_name : 'l’athlète'} 👋
                  </Text>
                  <Text style={[styles.userSubDot, dynamic.userSubDot]}>•</Text>
                  <Text style={[styles.userSubText, dynamic.userSubText]} numberOfLines={1}>
                    {effectiveLevelInfo?.badgeName || effectiveLevelInfo?.title || 'Athlète'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.athleteHeaderBadge, dynamic.athleteHeaderBadge]}
              onPress={() => setBadgeModalVisible(true)}
              activeOpacity={0.75}
              accessibilityLabel="Ouvrir les Rangs et Trophées d'Athlète"
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
        {/* 2. SECTION DES TUILES D'ACTION ADAPTABLES À L'ÉCRAN      */}
        {/* ======================================================== */}
        <View style={[styles.tilesContainer, dynamic.tilesContainer]}>
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

          {/* RANGÉE 1 TUILES JUMELLES : EXERCICE CIBLÉ & FAVORIS */}
          <View style={[styles.secondaryRow, dynamic.rowSpacing]}>
            {/* TUILE : EXERCICE CIBLÉ */}
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

            {/* TUILE : FAVORIS & CATALOGUE */}
            <TouchableOpacity
              style={[styles.priorityTwinCard, styles.favoritesCard, dynamic.cardRow]}
              onPress={() => router.push(favoriteCount > 0 ? '/exercises?filter=favorites' : '/exercises')}
              activeOpacity={0.85}
              accessibilityLabel={favoriteCount > 0 ? 'Mes exercices favoris' : 'Catalogue complet des exercices'}
            >
              <View style={[styles.priorityTwinIconCircle, styles.favoritesIconCircle, dynamic.iconCircle]}>
                <Text style={{ fontSize: dynamic.cardIconSize }}>{favoriteCount > 0 ? '⭐' : '📖'}</Text>
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.priorityTwinTitle, dynamic.cardTitle]} numberOfLines={1}>
                  {favoriteCount > 0 ? 'Favoris' : 'Catalogue'}
                </Text>
                <Text style={[styles.priorityTwinSub, { color: '#FBBF24' }, dynamic.cardSub]} numberOfLines={1}>
                  {favoriteCount > 0 ? `${favoriteCount} favori${favoriteCount > 1 ? 's' : ''}` : `${seedData.exercises.length} exercices`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* RANGÉE 2 : SÉANCE LIBRE & MES PROGRAMMES */}
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
                  {compatibleProgramsCount} disponible{compatibleProgramsCount > 1 ? 's' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* RANGÉE 3 : MULTIJOUEUR & CARDIO (ARÈNE & COURSE) */}
          <View style={[styles.secondaryRow, dynamic.rowSpacing]}>
            {/* ARÈNE */}
            <TouchableOpacity
              style={[styles.secondaryColCard, styles.arenaCard, dynamic.cardRow]}
              onPress={() => router.push('/arena')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir l'Arène Vitax"
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

            {/* COURSE & MARCHE */}
            <TouchableOpacity
              style={[styles.secondaryColCard, dynamic.cardRow, { borderColor: '#10B98155' }]}
              onPress={() => router.push('/running')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le suivi de course à pied et marche"
            >
              <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.16)', borderColor: '#10B981' }, dynamic.iconCircle]}>
                <Text style={{ fontSize: dynamic.cardIconSize }}>🏃‍♂️</Text>
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.secondaryColTitle, dynamic.cardTitle]} numberOfLines={1}>Course & Marche</Text>
                <Text style={[styles.secondaryColSub, { color: '#34D399' }, dynamic.cardSub]} numberOfLines={1}>
                  Chrono • Allure • Km
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 5. MOTIVATEUR HEBDOMADAIRE : FORME & OBJECTIF DE LA SEMAINE */}
        {/* ======================================================== */}
        <View style={[styles.weeklyFitnessCard, dynamic.weeklyFitnessCard]}>
          {/* Header de motivation : Titre + Badge d'élan */}
          <View style={[styles.weeklyFitnessHeader, dynamic.weeklyFitnessHeader]}>
            <View style={styles.weeklyFitnessTitleRow}>
              <Text style={{ fontSize: dynamic.weeklyTitleIconSize }}>🔥</Text>
              <Text style={[styles.weeklyFitnessTitle, dynamic.weeklyFitnessTitle]}>
                Forme de la semaine
              </Text>
              <Text style={styles.weeklyFitnessSubInfo}>
                • {weeklyFitness?.weekWorkoutsCount || 0}/{weeklyFitness?.targetWeeklyWorkouts || 4} {(weeklyFitness?.weekWorkoutsCount || 0) > 1 ? 'jours' : 'jour'}
              </Text>
            </View>

            <View style={styles.weeklyFitnessBadgeGroup}>
              {/* Badge % du coefficient de forme */}
              <View
                style={[
                  styles.weeklyFitnessPercentBadge,
                  (weeklyFitness?.fitnessScorePercent || 0) >= 100 && styles.weeklyFitnessBadgeHigh,
                  dynamic.weeklyFitnessBadge,
                ]}
              >
                <Text
                  style={[
                    styles.weeklyFitnessPercentBadgeText,
                    (weeklyFitness?.fitnessScorePercent || 0) >= 100 && styles.weeklyFitnessBadgeTextHigh,
                    dynamic.weeklyFitnessBadgeText,
                  ]}
                >
                  {weeklyFitness?.fitnessScorePercent ?? 0}%
                </Text>
              </View>

              {/* Badge statut motivationnel */}
              <View
                style={[
                  styles.weeklyFitnessBadge,
                  (weeklyFitness?.fitnessScorePercent || 0) >= 100 && styles.weeklyFitnessBadgeHigh,
                  dynamic.weeklyFitnessBadge,
                ]}
              >
                <Text
                  style={[
                    styles.weeklyFitnessBadgeText,
                    (weeklyFitness?.fitnessScorePercent || 0) >= 100 && styles.weeklyFitnessBadgeTextHigh,
                    dynamic.weeklyFitnessBadgeText,
                  ]}
                >
                  {weeklyFitness?.fitnessLabel || 'Prêt à démarrer ! 💪'}
                </Text>
              </View>
            </View>
          </View>

          {/* Jauge de régularité hebdo */}
          <View style={styles.weeklyTrackContainer}>
            <View style={styles.weeklyTrack}>
              <View
                style={[
                  styles.weeklyTrackFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        (weeklyFitness?.weekWorkoutsCount || 0) > 0 ? 12 : 0,
                        Math.round(
                          ((weeklyFitness?.weekWorkoutsCount || 0) /
                            (weeklyFitness?.targetWeeklyWorkouts || 4)) *
                            100
                        )
                      )
                    )}%`,
                    backgroundColor:
                      (weeklyFitness?.weekWorkoutsCount || 0) >=
                      (weeklyFitness?.targetWeeklyWorkouts || 4)
                        ? '#10B981'
                        : (weeklyFitness?.weekWorkoutsCount || 0) > 0
                        ? Colors.primary
                        : '#334155',
                  },
                ]}
              />
            </View>
          </View>

          {/* Rangée des 7 jours (L M M J V S D) avec validation des séances */}
          <View style={[styles.weeklyDaysRow, dynamic.weeklyDaysRow]}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((dayLabel, idx) => {
              const isTrained = weeklyFitness?.activeDays?.[idx] || false;
              const isToday = (weeklyFitness?.currentDayIndex ?? -1) === idx;
              return (
                <View
                  key={`day-${idx}`}
                  style={[
                    styles.dayPill,
                    dynamic.dayPill,
                    isTrained && styles.dayPillActive,
                    isToday && styles.dayPillToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      dynamic.dayPillText,
                      isTrained && styles.dayPillTextActive,
                      isToday && !isTrained && styles.dayPillTextToday,
                    ]}
                  >
                    {isTrained ? '✓' : dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Citation / Message d'encouragement dynamique */}
          {dynamic.showWeeklyFooter && (
            <View style={styles.weeklyFitnessFooter}>
              <Text style={styles.weeklyMotivationQuote} numberOfLines={1}>
                {weeklyFitness?.motivationalQuote ||
                  'Chaque séance vous rapproche de votre meilleur niveau !'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL : RANGS & TROPHÉES D'ATHLÈTE                       */}
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
                  {effectiveLevelInfo?.badgeName || 'Rang Novice'}
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
                  {achievementsStats.unlockedCount}/{achievementsStats.totalCount}
                </Text>
                <Text style={styles.badgeModalStatLabel}>Trophées</Text>
              </View>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>
                  {achievementsStats.totalSessions}
                </Text>
                <Text style={styles.badgeModalStatLabel}>Séances</Text>
              </View>
            </View>

            {/* Défilement des Rangs Athlètes */}
            <Text style={styles.kantoBadgesTitle}>
              🏅 Les {ATHLETE_RANK_TIERS.length} Rangs Athlètes Vitax
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kantoBadgesScroll}
            >
              {ATHLETE_RANK_TIERS.map((tier) => {
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
                      showAlert(
                        `${tier.emoji} ${tier.badgeName}`,
                        `${tier.description}\n\n` +
                        `🏅 Catégorie : ${tier.category} • ${tier.specialty}\n` +
                        `⚡ Palier : ${tier.minXp} XP\n\n` +
                        (isUnlocked
                          ? '✓ Rang débloqué et conquis !'
                          : `🔒 Verrouillé : plus que ${remaining} XP d’entraînement pour l’atteindre !`),
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

            {/* Raccourcis directs vers la gestion */}
            <View style={styles.badgeModalActions}>
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
                    Rangs & Trophées
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
                    Arène & Défis
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Gravir les ligues, défier vos amis et participer au Défi Co-op 50t
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
                  ? 'Connectez-vous pour récupérer vos séances et votre XP.'
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
                  <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <UserAvatar
                      avatarUrl={avatar_url}
                      fallbackEmoji="👤"
                      size={68}
                      showEditBadge
                      userName={user_name || 'Mon Profil'}
                      userSubtitle={`${levelInfo?.badgeName ? levelInfo.badgeName : 'Athlète'} • ${levelInfo?.currentXp || 0} XP`}
                      onPress={() => setAvatarPickerVisible(true)}
                      onEditPress={() => setAvatarPickerVisible(true)}
                      enableEnlarge
                    />
                    <TouchableOpacity
                      onPress={() => setAvatarPickerVisible(true)}
                      activeOpacity={0.8}
                      accessibilityLabel="Modifier ma photo de profil"
                    >
                      <Text style={{ color: '#38BDF8', fontSize: 12.5, fontWeight: '700', marginTop: 6 }}>
                        📷 Modifier la photo ❯
                      </Text>
                    </TouchableOpacity>
                  </View>
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

      <AvatarPickerModal
        visible={avatarPickerVisible}
        currentAvatarUrl={avatar_url}
        onClose={() => setAvatarPickerVisible(false)}
        onAvatarSelected={async (url) => {
          await setAvatarUrl(url);
        }}
      />
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
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 20,
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
    letterSpacing: -0.4,
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
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
  },
  athleteHeaderBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.warning,
    letterSpacing: -0.2,
  },
  xpGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.warning,
  },
  xpTrackContainer: {
    flex: 1,
  },
  xpTrack: {
    height: 8,
    backgroundColor: Colors.cardElevated,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0,
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpNumbersText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  xpPercentText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  endBadgeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBadgeEmoji: {
    fontSize: 22,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  activeResumeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryText,
  },

  /* ======================================================== */
  /* SECTION DES TUILES ADAPTABLES                            */
  /* ======================================================== */
  tilesContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  prioritySection: {
    marginBottom: 0,
  },
  heroCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.35)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 64,
  },
  heroCoachIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.25)',
  },
  heroCoachTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCoachTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroCoachTag: {
    backgroundColor: 'rgba(0, 199, 190, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 199, 190, 0.35)',
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
    fontSize: 13.5,
    marginTop: 2,
  },
  heroCoachActionPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  heroCoachActionText: {
    color: Colors.primaryText,
    fontSize: 13.5,
    fontWeight: '900',
  },
  priorityTwinRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityTwinCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    minHeight: 56,
    backgroundColor: Colors.cardBg,
  },
  targetMuscleCard: {
    borderColor: 'rgba(0, 199, 190, 0.3)',
    backgroundColor: Colors.cardBg,
  },
  favoritesCard: {
    borderColor: 'rgba(255, 214, 10, 0.3)',
    backgroundColor: Colors.cardBg,
  },
  priorityTwinIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 199, 190, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritesIconCircle: {
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
  },
  cardTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  priorityTwinTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  priorityTwinSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  priorityTwinArrow: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '700',
  },

  /* ======================================================== */
  /* ACTIONS RAPIDES : SÉANCE LIBRE & MES PROGRAMMES          */
  /* ======================================================== */
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  secondaryColCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    minHeight: 56,
  },
  secondaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programIconCircle: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
  },
  secondaryColTitle: {
    color: '#FFFFFF',
    fontSize: 18.5,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  secondaryColSub: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
  },
  secondaryArrow: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  arenaCard: {
    borderColor: 'rgba(191, 90, 242, 0.3)',
    backgroundColor: Colors.cardBg,
  },
  arenaIconCircle: {
    backgroundColor: 'rgba(191, 90, 242, 0.12)',
  },
  progressCard: {
    borderColor: 'rgba(48, 209, 88, 0.3)',
    backgroundColor: Colors.cardBg,
  },
  progressIconCircle: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  modalIncubatorHint: {
    backgroundColor: Colors.cardElevated,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalIncubatorHintText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  /* ======================================================== */
  /* MOTIVATEUR DE FORME HEBDOMADAIRE                         */
  /* ======================================================== */
  weeklyFitnessCard: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  weeklyFitnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
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
    letterSpacing: -0.3,
  },
  weeklyFitnessSubInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginLeft: 3,
  },
  weeklyFitnessBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weeklyFitnessPercentBadge: {
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 9999,
  },
  weeklyFitnessPercentBadgeText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  weeklyFitnessBadge: {
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 45, 85, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 9999,
  },
  weeklyFitnessBadgeHigh: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderColor: 'rgba(48, 209, 88, 0.4)',
  },
  weeklyFitnessBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  weeklyFitnessBadgeTextHigh: {
    color: Colors.success,
  },
  weeklyTrackContainer: {
    marginBottom: 12,
  },
  weeklyTrack: {
    height: 8,
    backgroundColor: Colors.cardElevated,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0,
  },
  weeklyTrackFill: {
    height: '100%',
    borderRadius: 4,
  },
  weeklyDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.18)',
    borderColor: Colors.success,
  },
  dayPillToday: {
    borderColor: Colors.warning,
    borderWidth: 1.5,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  dayPillTextActive: {
    color: Colors.success,
    fontWeight: '900',
  },
  dayPillTextToday: {
    color: Colors.warning,
    fontWeight: '900',
  },
  weeklyFitnessFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
    gap: 3,
  },
  weeklyStatsSummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.accent,
  },
  weeklyMotivationQuote: {
    fontSize: 11,
    color: Colors.textSecondary,
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
  activeBuddyHomeRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#283548',
    paddingTop: 8,
  },
  activeBuddyHomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeBuddyHomeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  activeBuddyHomeName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  activeBuddyHomeDot: {
    color: Colors.textMuted,
    fontSize: 12,
    marginRight: 4,
  },
  activeBuddyHomeBuff: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  activeBuddyHomeArrow: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
});
