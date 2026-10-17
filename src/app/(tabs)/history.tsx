import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { showAlert } from '../../utils/alert';
import {
  getAllWorkoutSessions,
  getOverallStats,
  deleteWorkoutSession,
  getWorkoutSessionDetails,
  getDailyWorkoutSummary,
  DailyWorkoutSummary,
  OverallStats,
} from '../../database/workoutRepository';
import { getAllExercises, getExerciseProgression } from '../../database/exerciseRepository';
import {
  WorkoutSession,
  WorkoutSessionWithSets,
  Exercise,
  ExerciseHistoryPoint,
} from '../../types';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { ProgressChart } from '../../components/stats/ProgressChart';
import { getExerciseUnitInfo } from '../../utils/exerciseUnits';
import { getUserGamificationStats, AthleteRankTier, Achievement } from '../../services/gamificationService';
import { UserLevelCard } from '../../components/stats/UserLevelCard';
import { WeightGoalsView } from '../../components/weight/WeightGoalsView';
import {
  getFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '../../services/favoritesService';
import {
  formatWorkoutShareText,
  formatDailyWorkoutShareText,
  shareWorkoutContent,
} from '../../services/workoutSharingService';
import { useSettingsStore } from '../../stores/settingsStore';

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<
    'sessions' | 'weight_goals' | 'progression' | 'achievements'
  >('sessions');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalWorkouts: 0,
    totalVolumeKg: 0,
    totalSets: 0,
    totalDurationMinutes: 0,
  });
  const [gamificationStats, setGamificationStats] = useState<
    Awaited<ReturnType<typeof getUserGamificationStats>> | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [expandedSessionDetails, setExpandedSessionDetails] =
    useState<WorkoutSessionWithSets | null>(null);
  const userName = useSettingsStore((state) => state.user_name);
  const [todaySummary, setTodaySummary] = useState<DailyWorkoutSummary | null>(null);

  const handleToggleFavorite = async (exerciseId: string) => {
    await toggleFavoriteExercise(exerciseId);
    const updated = await getFavoriteExerciseIds();
    setFavoriteIds(updated);
  };

  // Pour l'onglet progression
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [progressionData, setProgressionData] = useState<ExerciseHistoryPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<
    'max_weight' | 'max_reps' | 'estimated_1rm' | 'total_volume'
  >('max_weight');

  const loadData = useCallback(async () => {
    try {
      const [gStatsRes, stRes, exListRes, favsRes, initialSessionsRes, tSummaryRes] =
        await Promise.allSettled([
          getUserGamificationStats(),
          getOverallStats(),
          getAllExercises(),
          getFavoriteExerciseIds(),
          getAllWorkoutSessions(),
          getDailyWorkoutSummary(),
        ]);

      if (gStatsRes.status === 'fulfilled') setGamificationStats(gStatsRes.value);
      if (stRes.status === 'fulfilled') setStats(stRes.value);
      if (favsRes.status === 'fulfilled') setFavoriteIds(favsRes.value);
      if (tSummaryRes.status === 'fulfilled') setTodaySummary(tSummaryRes.value);

      const initialSessions =
        initialSessionsRes.status === 'fulfilled' ? initialSessionsRes.value : [];
      setSessions(initialSessions);

      const exList = exListRes.status === 'fulfilled' ? exListRes.value : [];
      setExercises(exList);

      if (initialSessions.length === 0) {
        void (async () => {
          try {
            const { fullCloudSyncToLocal } = await import('../../services/cloudSyncService');
            const syncRes = await fullCloudSyncToLocal();
            if (syncRes.sessionsCount > 0) {
              const updatedSess = await getAllWorkoutSessions();
              setSessions(updatedSess);
              const updatedGStats = await getUserGamificationStats();
              setGamificationStats(updatedGStats);
            }
          } catch {}
        })();
      }

      if (exList.length > 0 && !selectedExerciseId) {
        // Sélectionner par défaut le développé couché ou le premier exercice
        const bench = exList.find((e) => e.id === 'ex_bench_press') || exList[0];
        setSelectedExerciseId(bench.id);
        const prog = await getExerciseProgression(bench.id);
        setProgressionData(prog);
      } else if (selectedExerciseId) {
        const prog = await getExerciseProgression(selectedExerciseId);
        setProgressionData(prog);
      }
    } catch (err) {
      console.error('Erreur chargement historique:', err);
    }
  }, [selectedExerciseId]);

  const handleLevelCardPress = () => {
    if (!gamificationStats) return;
    const { levelInfo, totalXp } = gamificationStats;
    const remaining = Math.max(0, levelInfo.nextLevelXp - totalXp);
    showAlert(
      `${levelInfo.badgeEmoji} ${levelInfo.title} (Niv. ${levelInfo.level})`,
      `🏅 Catégorie : ${levelInfo.category} • ${levelInfo.specialty}\n\n` +
      `⚡ XP Total accumulé : ${totalXp} XP\n` +
      `📈 Progression du palier : ${levelInfo.progressPercent}%\n\n` +
      (levelInfo.level >= 9
        ? '👑 Rang Suprême de Légende Vitax conquis !'
        : `Prochain rang : ${levelInfo.nextBadgeTitle} ${levelInfo.nextBadgeEmoji} dans ${remaining} XP !`),
      [{ text: 'Super' }]
    );
  };

  const handleBadgePress = (tier: AthleteRankTier, isUnlocked: boolean) => {
    const totalXp = gamificationStats?.totalXp || 0;
    const remaining = Math.max(0, tier.minXp - totalXp);
    showAlert(
      `${tier.emoji} ${tier.badgeName}`,
      `${tier.description}\n\n` +
      `🏅 Catégorie : ${tier.category} • ${tier.specialty}\n` +
      `⚡ Palier : ${tier.minXp} XP (Actuel : ${totalXp} XP)\n\n` +
      (isUnlocked
        ? '✓ Rang débloqué et conquis avec honneur !'
        : `🔒 Verrouillé : plus que ${remaining} XP d’entraînement pour l’atteindre !`),
      [{ text: 'OK' }]
    );
  };

  const handleAchievementPress = (ach: Achievement) => {
    showAlert(
      `${ach.icon} ${ach.title}`,
      `${ach.description}\n\n` +
      `⚡ Récompense : +${ach.rewardXp} XP\n\n` +
      (ach.unlocked
        ? '✓ Trophée débloqué ! Bravo pour cet exploit athlétique !'
        : `Progression : ${ach.progress} / ${ach.maxProgress} (${Math.round((ach.progress / ach.maxProgress) * 100)}%)`),
      [{ text: 'Compris' }]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (
        params.tab === 'achievements' ||
        params.tab === 'progression' ||
        params.tab === 'sessions' ||
        params.tab === 'weight_goals'
      ) {
        setActiveTab(params.tab as any);
      }
      loadData();
    }, [loadData, params.tab])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { syncCloudAndLocal } = await import('../../services/cloudSyncService');
      await syncCloudAndLocal();
    } catch (e) {
      console.warn('Erreur synchro cloud onRefresh:', e);
    }
    await loadData();
    setRefreshing(false);
  };

  const handleSelectExercise = async (exId: string) => {
    setSelectedExerciseId(exId);
    const prog = await getExerciseProgression(exId);
    setProgressionData(prog);
  };

  const handleToggleExpandSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setExpandedSessionDetails(null);
    } else {
      setExpandedSessionId(sessionId);
      const details = await getWorkoutSessionDetails(sessionId);
      setExpandedSessionDetails(details);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    showAlert(
      'Supprimer la séance',
      'Voulez-vous vraiment effacer cette séance de votre historique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkoutSession(sessionId);
            await loadData();
          },
        },
      ]
    );
  };

  const handleShareSingleSession = async (sessionId: string) => {
    const details = await getWorkoutSessionDetails(sessionId);
    if (!details) {
      showAlert('Erreur', 'Impossible de charger les détails de cette séance.');
      return;
    }
    const text = formatWorkoutShareText(details, userName);
    await shareWorkoutContent('Ma Séance Vitax Sport', text);
  };

  const handleShareDay = async (targetDateStr?: string) => {
    const summary = await getDailyWorkoutSummary(targetDateStr);
    if (!summary || summary.exercises.length === 0) {
      showAlert('Aucun entraînement', 'Aucun exercice n’a été enregistré pour cette date.');
      return;
    }
    const text = formatDailyWorkoutShareText(summary, userName);
    await shareWorkoutContent(
      `Bilan Sportif du Jour (${summary.sessionsCount} séance${summary.sessionsCount > 1 ? 's' : ''})`,
      text
    );
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    return `${mins} min`;
  };

  const formatDate = (isoDate: string) => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {/* Sélecteur d'onglets de vue (5 onglets défilants) */}
      <View style={styles.tabSelectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabSelectorScroll}
        >
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sessions' && styles.tabButtonActive]}
            onPress={() => setActiveTab('sessions')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
              📋 Séances
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'weight_goals' && styles.tabButtonActive]}
            onPress={() => setActiveTab('weight_goals')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'weight_goals' && styles.tabTextActive]}>
              ⚖️ Poids & Objectifs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'progression' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('progression')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'progression' && styles.tabTextActive,
              ]}
            >
              📈 Progrès
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'achievements' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('achievements')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'achievements' && styles.tabTextActive,
              ]}
            >
              🏆 Rangs & Trophées
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Résumé des statistiques globales (uniquement séances & progression) */}
        {(activeTab === 'sessions' || activeTab === 'progression') && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.statLabel}>Séances</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {stats.totalVolumeKg > 1000
                  ? `${(stats.totalVolumeKg / 1000).toFixed(1)} t`
                  : `${stats.totalVolumeKg} kg`}
              </Text>
              <Text style={styles.statLabel}>Volume soulevé</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalSets}</Text>
              <Text style={styles.statLabel}>Séries validées</Text>
            </View>
          </View>
        )}

        {/* Onglet Suivi du Poids & Objectifs */}
        {activeTab === 'weight_goals' && (
          <WeightGoalsView onWeightUpdated={loadData} />
        )}

        {activeTab === 'sessions' && (
          /* Liste des séances terminées */
          <View>
            <Text style={styles.sectionTitle}>Historique des Entraînements</Text>

            {/* BANNIÈRE DE PARTAGE DU BILAN COMPLET DU JOUR */}
            {todaySummary && todaySummary.sessionsCount > 0 && (
              <Card style={styles.todayShareCard}>
                <View style={styles.todayShareTopRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>📅</Text>
                      <Text style={styles.todayShareTitle}>
                        Bilan du Jour ({todaySummary.sessionsCount} séance{todaySummary.sessionsCount > 1 ? 's' : ''})
                      </Text>
                    </View>
                    <Text style={styles.todayShareSub}>
                      {todaySummary.totalVolumeKg.toLocaleString()} kg soulevés • {todaySummary.totalSets} séries • {todaySummary.exercises.length} exercices
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.todayShareActionBtn}
                    onPress={() => handleShareDay(todaySummary.date)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.todayShareActionBtnText}>
                      📤 Partager le Jour
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}

            {sessions.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🏋️‍♂️</Text>
                <Text style={styles.emptyTitle}>Aucune séance enregistrée</Text>
                <Text style={styles.emptyText}>
                  Lancez votre première séance depuis l’onglet Programmes pour voir vos
                  performances ici !
                </Text>
              </Card>
            ) : (
              sessions.map((s) => {
                const isExpanded = expandedSessionId === s.id;

                return (
                  <Card key={s.id} style={styles.sessionCard}>
                    <TouchableOpacity
                      onPress={() => handleToggleExpandSession(s.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.sessionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sessionName}>
                            {s.program_name || 'Séance libre'}
                          </Text>
                          <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => handleShareSingleSession(s.id)}
                            style={styles.shareSessionBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.shareSessionIcon}>📤</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteSession(s.id)}
                            style={styles.deleteBtn}
                          >
                            <Text style={styles.deleteIcon}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Métriques clés de la séance */}
                      <View style={styles.sessionMetrics}>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricIcon}>⏱</Text>
                          <Text style={styles.metricText}>
                            {formatDuration(s.duration_seconds)}
                          </Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricIcon}>💪</Text>
                          <Text style={styles.metricText}>
                            {s.total_volume} kg soulevés
                          </Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricIcon}>✓</Text>
                          <Text style={styles.metricText}>
                            {s.total_sets} séries
                          </Text>
                        </View>
                      </View>

                      {s.notes && (
                        <Text style={styles.sessionNotes} numberOfLines={2}>
                          💬 {s.notes}
                        </Text>
                      )}

                      <Text style={styles.expandHint}>
                        {isExpanded ? 'Masquer le détail ▲' : 'Voir le détail des séries ▼'}
                      </Text>
                    </TouchableOpacity>

                    {/* Détail séries si déplié */}
                    {isExpanded && expandedSessionDetails && (
                      <View style={styles.detailsContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.detailsTitle}>Séries réalisées :</Text>
                        {expandedSessionDetails.sets.map((set, idx) => {
                          const unitInfo = getExerciseUnitInfo({
                            name: set.exercise_name,
                          });
                          return (
                            <View key={set.id || idx} style={styles.detailSetRow}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.detailExerciseName}>
                                  {set.exercise_name}
                                </Text>
                                <Text style={styles.detailSetValues}>
                                  Série {set.set_order} : {unitInfo.formatSet(set.weight, set.reps)}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => handleToggleFavorite(set.exercise_id)}
                                style={[
                                  styles.favHistoryBtn,
                                  favoriteIds.includes(set.exercise_id) && styles.favHistoryBtnActive,
                                ]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Text style={styles.favHistoryIcon}>
                                  {favoriteIds.includes(set.exercise_id) ? '⭐' : '☆'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}

                        {/* BOUTONS DE PARTAGE DANS LE DÉTAIL DÉPLIÉ */}
                        <View style={styles.expandedShareButtonsRow}>
                          <TouchableOpacity
                            style={styles.expandedShareSingleBtn}
                            onPress={() => handleShareSingleSession(s.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.expandedShareSingleBtnText}>
                              📤 Partager cette séance
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.expandedShareDayBtn}
                            onPress={() => handleShareDay(s.date)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.expandedShareDayBtnText}>
                              📅 Bilan complet du {formatDate(s.date)}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'progression' && (
          /* Onglet Progression & Graphique */
          <View>
            <Text style={styles.sectionTitle}>Courbe de Progression</Text>
            <Text style={styles.sectionSubtitle}>
              Sélectionnez un exercice pour visualiser votre évolution
            </Text>

            {/* Sélecteur d'exercice horizontal */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exerciseSelector}
            >
              {exercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  style={[
                    styles.exerciseChip,
                    selectedExerciseId === ex.id && styles.exerciseChipActive,
                  ]}
                  onPress={() => handleSelectExercise(ex.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.exerciseChipText,
                      selectedExerciseId === ex.id && styles.exerciseChipTextActive,
                    ]}
                  >
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Métriques au choix */}
            <View style={styles.metricPillsRow}>
              <TouchableOpacity
                style={[
                  styles.metricPill,
                  selectedMetric === 'max_weight' && styles.metricPillActive,
                ]}
                onPress={() => setSelectedMetric('max_weight')}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    selectedMetric === 'max_weight' && styles.metricPillTextActive,
                  ]}
                >
                  Poids Max
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.metricPill,
                  selectedMetric === 'max_reps' && styles.metricPillActive,
                ]}
                onPress={() => setSelectedMetric('max_reps')}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    selectedMetric === 'max_reps' && styles.metricPillTextActive,
                  ]}
                >
                  Max Reps
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.metricPill,
                  selectedMetric === 'estimated_1rm' && styles.metricPillActive,
                ]}
                onPress={() => setSelectedMetric('estimated_1rm')}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    selectedMetric === 'estimated_1rm' && styles.metricPillTextActive,
                  ]}
                >
                  1RM Estimé
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.metricPill,
                  selectedMetric === 'total_volume' && styles.metricPillActive,
                ]}
                onPress={() => setSelectedMetric('total_volume')}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    selectedMetric === 'total_volume' && styles.metricPillTextActive,
                  ]}
                >
                  Volume Total
                </Text>
              </TouchableOpacity>
            </View>

            {/* Graphique SVG */}
            <ProgressChart
              data={progressionData}
              metric={selectedMetric}
              exercise={exercises.find((e) => e.id === selectedExerciseId)}
            />
          </View>
        )}

        {/* Onglet Trophées & Gamification */}
        {activeTab === 'achievements' && gamificationStats && (
          <View>
            <Text style={styles.sectionTitle}>Rangs & Trophées d’Athlète</Text>
            <Text style={styles.sectionSubtitle}>
              Gagnez des points d’expérience (XP) à chaque séance et charge pour gravir les 9 Rangs Athlètes et devenir Légende Vitax !
            </Text>

            <UserLevelCard
              levelInfo={gamificationStats.levelInfo}
              onPress={handleLevelCardPress}
            />

            {/* Collection des 9 Rangs Athlètes */}
            <Text style={[styles.sectionTitle, { marginTop: 14, marginBottom: 4 }]}>
              Progression des Rangs Athlètes ({gamificationStats.allTiers.filter((t) => gamificationStats.totalXp >= t.minXp).length}/9)
            </Text>
            <Text style={styles.sectionSubtitle}>
              Chaque palier d’XP valide votre montée en grade sportif
            </Text>

            <View style={styles.badgeTiersList}>
              {gamificationStats.allTiers.map((tier) => {
                const isUnlocked = gamificationStats.totalXp >= tier.minXp;
                const isCurrent = gamificationStats.levelInfo.level === tier.level;

                return (
                  <TouchableOpacity
                    key={tier.level}
                    activeOpacity={0.85}
                    onPress={() => handleBadgePress(tier, isUnlocked)}
                  >
                    <Card
                      style={[
                        styles.pokemonBadgeCard,
                        isUnlocked && styles.pokemonBadgeCardUnlocked,
                        isCurrent && styles.pokemonBadgeCardCurrent,
                      ]}
                    >
                      <View style={styles.pokemonBadgeHeader}>
                        <View
                          style={[
                            styles.pokemonBadgeIconBox,
                            isUnlocked && styles.pokemonBadgeIconBoxUnlocked,
                          ]}
                        >
                          <Text style={styles.pokemonBadgeEmoji}>{tier.emoji}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={styles.pokemonBadgeTitleRow}>
                            <Text style={styles.pokemonBadgeTitle}>
                              {tier.badgeName}
                            </Text>
                            {isUnlocked ? (
                              <View style={styles.unlockedBadge}>
                                <Text style={styles.unlockedBadgeText}>✓ OBTENU</Text>
                              </View>
                            ) : (
                              <View style={styles.tierLockBadge}>
                                <Text style={styles.tierLockBadgeText}>
                                  {tier.minXp} XP requis
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.pokemonBadgeArena}>
                            Niveau {tier.level} • {tier.category} ({tier.specialty})
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.pokemonBadgeDesc}>{tier.description}</Text>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section Défis & Trophées */}
            <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 4 }]}>
              Trophées & Exploits Sportifs ({gamificationStats.achievements.filter((a) => a.unlocked).length}/{gamificationStats.achievements.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Accomplissez des exploits d’entraînement pour booster votre total d’XP
            </Text>

            {gamificationStats.achievements.map((ach) => {
              const progressPct = Math.min(
                100,
                Math.round((ach.progress / ach.maxProgress) * 100)
              );

              return (
                <TouchableOpacity
                  key={ach.id}
                  activeOpacity={0.85}
                  onPress={() => handleAchievementPress(ach)}
                >
                  <Card
                    style={[
                      styles.achievementCard,
                      ach.unlocked && styles.achievementCardUnlocked,
                    ]}
                  >
                    <View style={styles.achievementHeader}>
                      <View
                        style={[
                          styles.achievementIconBox,
                          ach.unlocked && styles.achievementIconBoxUnlocked,
                        ]}
                      >
                        <Text style={styles.achievementIcon}>{ach.icon}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.achievementTitleRow}>
                          <Text style={styles.achievementTitle}>{ach.title}</Text>
                          {ach.unlocked ? (
                            <View style={styles.unlockedBadge}>
                              <Text style={styles.unlockedBadgeText}>✓ DÉBLOQUÉ</Text>
                            </View>
                          ) : (
                            <View style={styles.rewardBadge}>
                              <Text style={styles.rewardBadgeText}>+{ach.rewardXp} XP</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.achievementDesc}>{ach.description}</Text>
                      </View>
                    </View>

                    {/* Barre de progression du trophée */}
                    <View style={styles.achProgressSection}>
                      <View style={styles.achProgressTrack}>
                        <View
                          style={[
                            styles.achProgressBar,
                            ach.unlocked && styles.achProgressBarUnlocked,
                            { width: `${progressPct}%` },
                          ]}
                        />
                      </View>
                      <View style={styles.achProgressLabels}>
                        <Text style={styles.achProgressText}>
                          {ach.unlocked
                            ? 'Trophée débloqué !'
                            : `Progression : ${ach.progress} / ${ach.maxProgress}`}
                        </Text>
                        <Text
                          style={[
                            styles.achRewardLabel,
                            ach.unlocked && styles.achRewardLabelUnlocked,
                          ]}
                        >
                          {ach.unlocked ? `+${ach.rewardXp} XP acquis` : `${progressPct}%`}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabSelectorContainer: {
    backgroundColor: '#121A28',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2C42',
    overflow: 'hidden',
  },
  tabSelectorScroll: {
    flexDirection: 'row',
    padding: 4,
    gap: 6,
  },
  tabButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#131D2D',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2B3E',
  },
  statValue: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  sessionCard: {
    marginBottom: 14,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sessionName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  sessionDate: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteIcon: {
    fontSize: 16,
  },
  sessionMetrics: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#0F1624',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  metricText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionNotes: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  expandHint: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2C42',
    marginVertical: 10,
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailsTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#172233',
  },
  detailExerciseName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  detailSetValues: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  favHistoryBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  favHistoryBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  favHistoryIcon: {
    fontSize: 13,
  },
  exerciseSelector: {
    gap: 8,
    paddingVertical: 6,
    marginBottom: 14,
  },
  exerciseChip: {
    backgroundColor: '#162235',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22324A',
  },
  exerciseChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  exerciseChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseChipTextActive: {
    color: '#FFFFFF',
  },
  metricPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#141E2E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#202E44',
  },
  metricPillActive: {
    backgroundColor: '#1E2F4A',
    borderColor: Colors.accent,
  },
  metricPillText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricPillTextActive: {
    color: Colors.accent,
  },
  achievementCard: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#121A28',
    borderColor: '#1D2A3D',
  },
  achievementCardUnlocked: {
    borderColor: '#10B981',
    backgroundColor: '#0F1E29',
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#172233',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#24344D',
  },
  achievementIconBoxUnlocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  achievementTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  unlockedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  unlockedBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rewardBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  rewardBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  achievementDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  achProgressSection: {
    marginTop: 2,
  },
  achProgressTrack: {
    height: 6,
    backgroundColor: '#182436',
    borderRadius: 3,
    overflow: 'hidden',
  },
  achProgressBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  achProgressBarUnlocked: {
    backgroundColor: '#10B981',
  },
  achProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  achProgressText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  achRewardLabel: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '700',
  },
  achRewardLabelUnlocked: {
    color: '#10B981',
  },
  badgeTiersList: {
    marginBottom: 16,
  },
  pokemonBadgeCard: {
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#111A27',
    borderWidth: 1.5,
    borderColor: '#1C283B',
    borderRadius: 14,
  },
  pokemonBadgeCardUnlocked: {
    borderColor: '#10B981',
    backgroundColor: '#0F1E29',
  },
  pokemonBadgeCardCurrent: {
    borderColor: '#F59E0B',
    backgroundColor: '#19241B',
  },
  pokemonBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pokemonBadgeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#172233',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#24344D',
  },
  pokemonBadgeIconBoxUnlocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  pokemonBadgeEmoji: {
    fontSize: 22,
  },
  pokemonBadgeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  pokemonBadgeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  pokemonBadgeArena: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  pokemonBadgeDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  tierLockBadge: {
    backgroundColor: '#1A2436',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#25354E',
  },
  tierLockBadgeText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  legendaryRewardBadgeInline: {
    backgroundColor: '#382806',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  legendaryRewardBadgeText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '800',
  },
  loadingPokemonCard: {
    padding: 32,
    alignItems: 'center',
    marginVertical: 16,
    borderRadius: 16,
  },
  loadingPokemonTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  loadingPokemonSub: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  todayShareCard: {
    backgroundColor: 'rgba(255, 90, 31, 0.1)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF5A1F',
    padding: 12,
    marginBottom: 14,
  },
  todayShareTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  todayShareTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  todayShareSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  todayShareActionBtn: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayShareActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  shareSessionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E2C42',
    borderWidth: 1,
    borderColor: '#2D3F5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSessionIcon: {
    fontSize: 14,
  },
  expandedShareButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A2436',
  },
  expandedShareSingleBtn: {
    flex: 1,
    backgroundColor: '#1E2B40',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3C58',
  },
  expandedShareSingleBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  expandedShareDayBtn: {
    flex: 1.2,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
  },
  expandedShareDayBtnText: {
    color: '#FF7A45',
    fontSize: 11,
    fontWeight: '900',
  },
});
