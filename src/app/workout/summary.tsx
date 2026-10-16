import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { calculateSessionXp } from '../../services/gamificationService';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import {
  getWorkoutSessionDetails,
  getDailyWorkoutSummary,
  DailyWorkoutSummary,
} from '../../database/workoutRepository';
import { WorkoutSessionWithSets, WorkoutSetDetail } from '../../types';
import {
  formatWorkoutDuration,
  formatWorkoutShareText,
  formatDailyWorkoutShareText,
  shareWorkoutContent,
} from '../../services/workoutSharingService';
import { getExerciseUnitInfo } from '../../utils/exerciseUnits';

export default function WorkoutSummaryScreen() {
  const lastSession = useWorkoutSessionStore((state) => state.lastCompletedSession);
  const userName = useSettingsStore((state) => state.user_name);
  const xpSummary = lastSession?.session ? calculateSessionXp(lastSession.session) : null;

  const [sessionDetails, setSessionDetails] = useState<WorkoutSessionWithSets | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyWorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFullDetails() {
      if (!lastSession?.session?.id) {
        setLoading(false);
        return;
      }
      try {
        const [details, dSummary] = await Promise.all([
          getWorkoutSessionDetails(lastSession.session.id),
          getDailyWorkoutSummary(lastSession.session.date),
        ]);
        setSessionDetails(details);
        setDailySummary(dSummary);
      } catch (err) {
        console.warn('Erreur chargement récapitulatif séance:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFullDetails();
  }, [lastSession]);

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleGoHistory = () => {
    router.replace('/(tabs)/history');
  };

  // Partager uniquement la séance actuelle
  const handleShareCurrentSession = async () => {
    if (!sessionDetails) {
      if (!lastSession?.session) return;
      const fallbackDetails: WorkoutSessionWithSets = {
        ...lastSession.session,
        sets: (lastSession.sets || []).map((s) => ({
          ...s,
          exercise_name: 'Exercice',
          target_muscle: 'Musculation',
        })),
      };
      const text = formatWorkoutShareText(fallbackDetails, userName);
      await shareWorkoutContent('Ma Séance Vitax Sport', text);
      return;
    }
    const text = formatWorkoutShareText(sessionDetails, userName);
    await shareWorkoutContent('Ma Séance Vitax Sport', text);
  };

  // Partager l'ensemble des exercices du jour (toutes séances confondues)
  const handleShareDailyWorkout = async () => {
    if (!dailySummary || dailySummary.exercises.length === 0) {
      await handleShareCurrentSession();
      return;
    }
    const text = formatDailyWorkoutShareText(dailySummary, userName);
    await shareWorkoutContent(
      `Mon Bilan Sportif du Jour (${dailySummary.sessionsCount} séance${dailySummary.sessionsCount > 1 ? 's' : ''})`,
      text
    );
  };

  const handleChallengeFromSummary = () => {
    if (sessionDetails?.program_id) {
      router.push({
        pathname: '/arena',
        params: {
          openChallenge: '1',
          challengeType: 'program',
          programId: sessionDetails.program_id,
          targetVolume: String(Math.round(sessionDetails.total_volume || 3000)),
        },
      });
      return;
    }

    const sets = sessionDetails?.sets || [];
    if (sets.length > 0) {
      const topSet = sets.reduce((prev, curr) => ((curr.weight || 0) > (prev.weight || 0) ? curr : prev));
      router.push({
        pathname: '/arena',
        params: {
          openChallenge: '1',
          challengeType: 'exercise',
          exerciseId: topSet.exercise_id,
          targetWeight: topSet.weight > 0 ? String(topSet.weight) : undefined,
          targetReps: topSet.reps > 0 ? String(topSet.reps) : '10',
        },
      });
      return;
    }

    router.push({
      pathname: '/arena',
      params: {
        openChallenge: '1',
      },
    });
  };

  // Regrouper les séries par exercice pour l'affichage propre de la séance
  const groupedSessionExercises = React.useMemo(() => {
    if (!sessionDetails?.sets) return [];
    const map = new Map<string, { name: string; targetMuscle?: string; sets: WorkoutSetDetail[] }>();

    sessionDetails.sets.forEach((set) => {
      if (!set.completed) return;
      let item = map.get(set.exercise_id);
      if (!item) {
        item = {
          name: set.exercise_name,
          targetMuscle: set.target_muscle,
          sets: [],
        };
        map.set(set.exercise_id, item);
      }
      item.sets.push(set);
    });

    return Array.from(map.values());
  }, [sessionDetails]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ======================================================== */}
        {/* EN-TÊTE ATHLÉTIQUE SPORT-FIRST                           */}
        {/* ======================================================== */}
        <View style={styles.celebrationHeader}>
          <Text style={styles.trophyEmoji}>🏋️‍♂️</Text>
          <Text style={styles.title}>Séance Enregistrée !</Text>
          <Text style={styles.subtitle}>
            Félicitations {userName ? `${userName} ` : ''}! Votre entraînement et vos records sont sauvegardés avec succès.
          </Text>
        </View>

        {/* ======================================================== */}
        {/* CARTE DES MÉTRIQUES CLÉS DE LA SÉANCE                    */}
        {/* ======================================================== */}
        <Card style={styles.metricsHeroCard}>
          <Text style={styles.sessionTitleHeader}>
            {lastSession?.session.program_name || 'SÉANCE LIBRE'}
          </Text>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Volume Soulevé</Text>
              <Text style={styles.metricValueHighlight}>
                {(lastSession?.session.total_volume ?? 0).toLocaleString()} kg
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Séries Réalisées</Text>
              <Text style={styles.metricValue}>
                {lastSession?.session.total_sets ?? 0} séries
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Durée d’effort</Text>
              <Text style={styles.metricValue}>
                {formatWorkoutDuration(lastSession?.session.duration_seconds)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>XP d’Entraînement</Text>
              <Text style={[styles.metricValue, { color: '#FF7A45', fontWeight: '900' }]}>
                +{xpSummary?.totalXp ?? 100} XP
              </Text>
            </View>
          </View>
        </Card>

        {/* ======================================================== */}
        {/* NOUVEL ŒUF DÉCOUVERT (OPTION A)                          */}
        {/* ======================================================== */}
        {lastSession?.droppedEgg && (
          <Card style={styles.droppedEggCard}>
            <View style={styles.droppedEggRow}>
              <View style={styles.droppedEggIconCircle}>
                <Text style={styles.droppedEggEmoji}>
                  {lastSession.droppedEgg.rarity === 'champion'
                    ? '🟣'
                    : lastSession.droppedEgg.rarity === 'starter'
                    ? '🟢'
                    : '🟠'}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.droppedEggBadgeRow}>
                  <Text style={styles.droppedEggBadgeText}>NOUVEL ŒUF OBTENU !</Text>
                </View>
                <Text style={styles.droppedEggName}>{lastSession.droppedEgg.name}</Text>
                <Text style={styles.droppedEggMeta}>
                  {lastSession.droppedEgg.required_xp} XP requis pour éclore
                </Text>
              </View>
              <TouchableOpacity
                style={styles.droppedEggActionBtn}
                onPress={() => router.push({ pathname: '/(tabs)/history', params: { tab: 'pokemon' } })}
                activeOpacity={0.8}
              >
                <Text style={styles.droppedEggActionText}>Incuber ❯</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {lastSession?.inventoryFullNotice && (
          <View style={styles.fullInventoryNoticeBox}>
            <Text style={styles.fullInventoryNoticeEmoji}>🧺</Text>
            <Text style={styles.fullInventoryNoticeText}>
              Réserve d’œufs pleine (9/9). Rendez-vous dans les Incubateurs pour faire éclore vos œufs et libérer des places !
            </Text>
          </View>
        )}

        {/* ======================================================== */}
        {/* DÉTAIL DES EXERCICES RÉALISÉS DANS CETTE SÉANCE           */}
        {/* ======================================================== */}
        <Card style={styles.exercisesCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>
              📋 Exercices de la séance ({groupedSessionExercises.length})
            </Text>
            <Text style={styles.cardSectionSub}>
              {lastSession?.session.total_sets ?? 0} séries au total
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 14 }} />
          ) : groupedSessionExercises.length === 0 ? (
            <Text style={styles.noExercisesNote}>Détails des séries enregistrés ✓</Text>
          ) : (
            groupedSessionExercises.map((ex, idx) => {
              const unit = getExerciseUnitInfo({ name: ex.name });
              return (
                <View key={idx} style={styles.exerciseRowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseNameText}>{ex.name}</Text>
                    <Text style={styles.exerciseSetsText}>
                      {ex.sets.map((s) => unit.formatSet(s.weight, s.reps)).join(' • ')}
                    </Text>
                  </View>
                  <View style={styles.exerciseSetsCountBadge}>
                    <Text style={styles.exerciseSetsCountText}>
                      {ex.sets.length} série{ex.sets.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* ======================================================== */}
        {/* MODULE BILAN GLOBAL DU JOUR (MULTI-SÉANCES CUMULÉES)     */}
        {/* ======================================================== */}
        {dailySummary && dailySummary.sessionsCount > 1 && (
          <Card style={styles.dailyConsolidatedCard}>
            <View style={styles.dailyConsolidatedHeader}>
              <View style={styles.dailyBadgePill}>
                <Text style={styles.dailyBadgePillText}>
                  🔥 {dailySummary.sessionsCount} SÉANCES AUJOURD’HUI
                </Text>
              </View>
              <Text style={styles.dailyTitle}>Bilan Global de la Journée</Text>
              <Text style={styles.dailySubtitle}>
                Vous avez réalisé plusieurs entraînements aujourd’hui. Partagez l’ensemble de vos exercices en un seul récapitulatif !
              </Text>
            </View>

            <View style={styles.dailyStatsGrid}>
              <View style={styles.dailyStatItem}>
                <Text style={styles.dailyStatVal}>{dailySummary.totalVolumeKg.toLocaleString()} kg</Text>
                <Text style={styles.dailyStatLbl}>Volume cumulé</Text>
              </View>
              <View style={styles.dailyStatItem}>
                <Text style={styles.dailyStatVal}>{dailySummary.totalSets}</Text>
                <Text style={styles.dailyStatLbl}>Séries totales</Text>
              </View>
              <View style={styles.dailyStatItem}>
                <Text style={styles.dailyStatVal}>{dailySummary.exercises.length}</Text>
                <Text style={styles.dailyStatLbl}>Exercices du jour</Text>
              </View>
              <View style={styles.dailyStatItem}>
                <Text style={styles.dailyStatVal}>
                  {formatWorkoutDuration(dailySummary.totalDurationSeconds)}
                </Text>
                <Text style={styles.dailyStatLbl}>Temps cumulé</Text>
              </View>
            </View>

            {/* Bouton prioritaire pour partager TOUS les exercices du jour */}
            <TouchableOpacity
              style={styles.shareDailyButton}
              onPress={handleShareDailyWorkout}
              activeOpacity={0.85}
            >
              <Text style={styles.shareDailyButtonText}>
                📤 Partager TOUS les exercices du jour ({dailySummary.sessionsCount} séances)
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* ======================================================== */}
        {/* BOUTONS D'ACTION PRINCIPAUX                              */}
        {/* ======================================================== */}
        <View style={styles.actions}>
          {/* Si une seule séance aujourd'hui, bouton direct de partage du jour */}
          {dailySummary && dailySummary.sessionsCount <= 1 ? (
            <Button
              title="Partager ma séance 📤"
              variant="primary"
              size="lg"
              onPress={handleShareDailyWorkout}
              style={{ marginBottom: 10 }}
            />
          ) : (
            <Button
              title="Partager uniquement cette séance 📤"
              variant="outline"
              size="md"
              onPress={handleShareCurrentSession}
              style={{ marginBottom: 10 }}
            />
          )}

          <Button
            title="⚔️ Lancer un Défi depuis cette séance"
            variant="primary"
            size="md"
            onPress={handleChallengeFromSummary}
            style={{ marginBottom: 10 }}
          />

          <Button
            title="Consulter l’Arène & Défis Amis 🏟️"
            variant="outline"
            size="md"
            onPress={() => router.push('/arena')}
            style={{ marginBottom: 10 }}
          />

          <Button
            title="Voir mon historique & progression 📈"
            variant="secondary"
            size="md"
            onPress={handleGoHistory}
            style={{ marginBottom: 10 }}
          />

          <Button
            title="Retour à l’accueil"
            variant="secondary"
            size="sm"
            onPress={handleGoHome}
          />
        </View>

        {/* ======================================================== */}
        {/* SECTION SECONDAIRE / BADGES & TROPHÉES (DISCRÈTE EN BAS) */}
        {/* ======================================================== */}
        {lastSession?.hatchedPokemon && lastSession.hatchedPokemon.length > 0 && (
          <View style={styles.trophyFooterContainer}>
            {lastSession.hatchedPokemon.map((hatched, idx) => (
              <View key={idx} style={styles.trophyMiniBadgeRow}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>{hatched.pokemonEmoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trophyMiniBadgeTitle}>
                    Nouveau Trophée Débloqué : {hatched.pokemonName} !
                  </Text>
                  <Text style={styles.trophyMiniBadgeSub}>
                    Ajouté à votre collection d’arène sportive.
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  celebrationHeader: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  trophyEmoji: {
    fontSize: 48,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  metricsHeroCard: {
    backgroundColor: '#121A28',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  sessionTitleHeader: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F1624',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#192436',
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  metricValueHighlight: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 4,
  },
  exercisesCard: {
    backgroundColor: '#121A28',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2D44',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  cardSectionSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  exerciseRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1624',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#182436',
    marginBottom: 8,
  },
  exerciseNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  exerciseSetsText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  exerciseSetsCountBadge: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.3)',
  },
  exerciseSetsCountText: {
    color: '#FF7A45',
    fontSize: 10,
    fontWeight: '900',
  },
  noExercisesNote: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  dailyConsolidatedCard: {
    backgroundColor: 'rgba(255, 90, 31, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FF5A1F',
  },
  dailyConsolidatedHeader: {
    marginBottom: 12,
  },
  dailyBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  dailyBadgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dailyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  dailySubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  dailyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0E1522',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2E46',
    marginBottom: 12,
  },
  dailyStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  dailyStatVal: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
  },
  dailyStatLbl: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  shareDailyButton: {
    backgroundColor: '#FF5A1F',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareDailyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  actions: {
    marginTop: 4,
  },
  trophyFooterContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A2538',
    paddingTop: 12,
  },
  trophyMiniBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1626',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 6,
  },
  trophyMiniBadgeTitle: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '800',
  },
  trophyMiniBadgeSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  droppedEggCard: {
    backgroundColor: '#1E1B2E',
    borderColor: '#8B5CF6',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  droppedEggRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  droppedEggIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D224D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  droppedEggEmoji: {
    fontSize: 26,
  },
  droppedEggBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B5CF625',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  droppedEggBadgeText: {
    color: '#C4B5FD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  droppedEggName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  droppedEggMeta: {
    color: '#A78BFA',
    fontSize: 11,
    marginTop: 2,
  },
  droppedEggActionBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  droppedEggActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  fullInventoryNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#251A13',
    borderColor: '#F9731640',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  fullInventoryNoticeEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  fullInventoryNoticeText: {
    color: '#FDBA74',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
});
