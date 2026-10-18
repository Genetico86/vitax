import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { RunningProgressChart } from '../../components/running/RunningProgressChart';
import {
  getAllRunningSessions,
  createRunningSession,
  deleteRunningSession,
  getRunningStats,
  formatPace,
  formatDuration,
} from '../../database/runningRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RunningSession, RunningStats } from '../../types';
import { showAlert } from '../../utils/alert';
import { calculateRunningSessionXp } from '../../services/gamificationService';
import { claimDailyWorkoutBonus } from '../../services/exerciseWeightingService';
import { updateTrainerProfileXpAndStats } from '../../services/multiplayer/profileService';

const RUNNING_TIMER_STORAGE_KEY = '@vitax_active_running_timer';

export default function RunningScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<RunningSession[]>([]);
  const [stats, setStats] = useState<RunningStats>({
    totalSessions: 0,
    totalDistanceKm: 0,
    totalDurationSeconds: 0,
    bestPaceSecondsPerKm: 0,
    averagePaceSecondsPerKm: 0,
    averageDistanceKm: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Modal d'enregistrement manuel
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [distanceInput, setDistanceInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [secondsInput, setSecondsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [savingLoading, setSavingLoading] = useState(false);

  const [activityType, setActivityType] = useState<'running' | 'walking'>('running');

  // Chronomètre en direct basé sur un timestamp réel (survit au verrouillage d'écran et à la navigation)
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartTimestampRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef<number>(0);

  const persistTimerState = useCallback(
    async (running: boolean, startTs: number | null, accSecs: number, actType: 'running' | 'walking') => {
      try {
        if (!running && accSecs === 0 && !startTs) {
          await AsyncStorage.removeItem(RUNNING_TIMER_STORAGE_KEY);
          return;
        }
        await AsyncStorage.setItem(
          RUNNING_TIMER_STORAGE_KEY,
          JSON.stringify({
            isRunning: running,
            startTimestamp: startTs,
            accumulatedSeconds: accSecs,
            activityType: actType,
          })
        );
      } catch {}
    },
    []
  );

  // Restauration automatique d'un chronomètre de course/marche en cours au montage de l'écran
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RUNNING_TIMER_STORAGE_KEY);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const acc = Number(parsed.accumulatedSeconds) || 0;
        const startTs = parsed.startTimestamp ? Number(parsed.startTimestamp) : null;
        const running = Boolean(parsed.isRunning);
        if (parsed.activityType === 'walking' || parsed.activityType === 'running') {
          setActivityType(parsed.activityType);
        }
        accumulatedSecondsRef.current = acc;
        if (running && startTs) {
          runStartTimestampRef.current = startTs;
          const delta = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
          setTimerSeconds(acc + delta);
          setIsTimerRunning(true);
        } else if (acc > 0) {
          runStartTimestampRef.current = null;
          setTimerSeconds(acc);
          setIsTimerRunning(false);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const sess = await getAllRunningSessions();
      setSessions(sess);
      const st = await getRunningStats();
      setStats(st);
    } catch (err) {
      console.error('Erreur chargement course & marche:', err);
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

  // Gestion du chronomètre en direct via timestamps réels
  useEffect(() => {
    if (isTimerRunning) {
      if (!runStartTimestampRef.current) {
        runStartTimestampRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        if (runStartTimestampRef.current) {
          const delta = Math.max(0, Math.floor((Date.now() - runStartTimestampRef.current) / 1000));
          setTimerSeconds(accumulatedSecondsRef.current + delta);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const handleStartTimer = () => {
    const now = Date.now();
    runStartTimestampRef.current = now;
    setIsTimerRunning(true);
    void persistTimerState(true, now, accumulatedSecondsRef.current, activityType);
  };

  const handlePauseTimer = () => {
    if (runStartTimestampRef.current) {
      const delta = Math.max(0, Math.floor((Date.now() - runStartTimestampRef.current) / 1000));
      accumulatedSecondsRef.current += delta;
      runStartTimestampRef.current = null;
      setTimerSeconds(accumulatedSecondsRef.current);
    }
    setIsTimerRunning(false);
    void persistTimerState(false, null, accumulatedSecondsRef.current, activityType);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    runStartTimestampRef.current = null;
    accumulatedSecondsRef.current = 0;
    setTimerSeconds(0);
    void persistTimerState(false, null, 0, activityType);
  };

  const handleStopAndSave = () => {
    let finalSeconds = timerSeconds;
    if (runStartTimestampRef.current) {
      const delta = Math.max(0, Math.floor((Date.now() - runStartTimestampRef.current) / 1000));
      finalSeconds = accumulatedSecondsRef.current + delta;
    }
    if (finalSeconds < 10) {
      showAlert(
        'Chronomètre trop court',
        activityType === 'walking'
          ? 'Marchez au moins quelques secondes avant de valider.'
          : 'Courrez au moins quelques secondes avant de valider.'
      );
      return;
    }
    accumulatedSecondsRef.current = finalSeconds;
    runStartTimestampRef.current = null;
    setTimerSeconds(finalSeconds);
    setIsTimerRunning(false);
    void persistTimerState(false, null, finalSeconds, activityType);
    setFinishModalVisible(true);
  };

  const handleSaveTimerSession = async () => {
    const dist = parseFloat(distanceInput.replace(',', '.'));
    if (!dist || dist <= 0) {
      showAlert('Distance requise', 'Veuillez saisir les kilomètres parcourus (ex: 5.2).');
      return;
    }

    setSavingLoading(true);
    try {
      const isWalk = activityType === 'walking';
      const tag = isWalk ? '[Marche] ' : '';
      const notesToSave = notesInput.trim() ? `${tag}${notesInput.trim()}` : (isWalk ? '[Marche]' : undefined);

      const sessionXp = calculateRunningSessionXp(dist, timerSeconds, isWalk);
      let dailyBonus = 0;
      try {
        const bonusRes = await claimDailyWorkoutBonus();
        if (bonusRes.awarded) {
          dailyBonus = bonusRes.bonusXp;
        }
      } catch (bErr) {
        console.warn('Erreur claimDailyWorkoutBonus:', bErr);
      }
      const totalSessionXp = sessionXp + dailyBonus;

      await createRunningSession({
        distance_km: dist,
        duration_seconds: timerSeconds,
        notes: notesToSave,
        xp_earned: sessionXp,
      });

      // Attribution des points d'expérience au profil d'athlète et synchronisation
      await updateTrainerProfileXpAndStats(totalSessionXp, 0);

      setFinishModalVisible(false);
      runStartTimestampRef.current = null;
      accumulatedSecondsRef.current = 0;
      setTimerSeconds(0);
      setDistanceInput('');
      setNotesInput('');
      void persistTimerState(false, null, 0, activityType);
      await loadData();

      const bonusMsg = dailyBonus > 0 ? ` (+${dailyBonus} XP bonus quotidien 🎁)` : '';
      showAlert(
        isWalk ? 'Marche enregistrée ! 🚶‍♂️🔥' : 'Course enregistrée ! 🏃‍♂️🔥',
        `Superbe séance de ${dist} km en ${formatDuration(timerSeconds)} !\n⚡ +${sessionXp} XP${bonusMsg} crédités sur votre profil athlète !`
      );
    } catch {
      showAlert('Erreur', 'Impossible d’enregistrer la session.');
    } finally {
      setSavingLoading(false);
    }
  };

  const handleSaveManualSession = async () => {
    const dist = parseFloat(distanceInput.replace(',', '.'));
    const mins = parseInt(minutesInput, 10) || 0;
    const secs = parseInt(secondsInput, 10) || 0;
    const totalSecs = mins * 60 + secs;

    if (!dist || dist <= 0) {
      showAlert('Distance invalide', 'Veuillez entrer une distance en kilomètres (ex: 7.5).');
      return;
    }
    if (totalSecs <= 0) {
      showAlert('Durée invalide', 'Veuillez renseigner le temps de votre sortie.');
      return;
    }

    setSavingLoading(true);
    try {
      const isWalk = activityType === 'walking';
      const tag = isWalk ? '[Marche] ' : '';
      const notesToSave = notesInput.trim() ? `${tag}${notesInput.trim()}` : (isWalk ? '[Marche]' : undefined);

      const sessionXp = calculateRunningSessionXp(dist, totalSecs, isWalk);
      let dailyBonus = 0;
      try {
        const bonusRes = await claimDailyWorkoutBonus();
        if (bonusRes.awarded) {
          dailyBonus = bonusRes.bonusXp;
        }
      } catch (bErr) {
        console.warn('Erreur claimDailyWorkoutBonus:', bErr);
      }
      const totalSessionXp = sessionXp + dailyBonus;

      await createRunningSession({
        distance_km: dist,
        duration_seconds: totalSecs,
        notes: notesToSave,
        xp_earned: sessionXp,
      });

      // Attribution des points d'expérience au profil d'athlète et synchronisation
      await updateTrainerProfileXpAndStats(totalSessionXp, 0);

      setManualModalVisible(false);
      setDistanceInput('');
      setMinutesInput('');
      setSecondsInput('');
      setNotesInput('');
      await loadData();

      const bonusMsg = dailyBonus > 0 ? ` (+${dailyBonus} XP bonus quotidien 🎁)` : '';
      showAlert(
        isWalk ? 'Marche enregistrée ! 🚶‍♂️🏅' : 'Course enregistrée ! 🏃‍♂️🏅',
        `${dist} km validés avec une allure moyenne de ${formatPace(totalSecs / dist)}.\n⚡ +${sessionXp} XP${bonusMsg} ajoutés à votre profil athlète !`
      );
    } catch {
      showAlert('Erreur', 'Impossible d’enregistrer la sortie.');
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDeleteSession = (id: string, dist: number) => {
    showAlert(
      'Supprimer cette course',
      `Voulez-vous supprimer cette sortie de ${dist} km de votre historique ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteRunningSession(id);
            await loadData();
          },
        },
      ]
    );
  };

  const formatTimerDisplay = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barre d'en-tête */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>❮</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Course & Marche à Pied</Text>
          <Text style={styles.headerSubtitle}>Suivi des temps, allures et distances</Text>
        </View>
        <TouchableOpacity
          style={styles.manualEntryBtn}
          onPress={() => {
            setDistanceInput('');
            setMinutesInput('');
            setSecondsInput('');
            setNotesInput('');
            setManualModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.manualEntryBtnText}>+ Saisie</Text>
        </TouchableOpacity>
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
        {/* Sélecteur d'activité : Course ou Marche */}
        <View style={styles.activitySegmentContainer}>
          <TouchableOpacity
            style={[
              styles.activitySegmentBtn,
              activityType === 'running' && styles.activitySegmentBtnActive,
            ]}
            onPress={() => setActivityType('running')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.activitySegmentText,
                activityType === 'running' && styles.activitySegmentTextActive,
              ]}
            >
              🏃‍♂️ Course à pied
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.activitySegmentBtn,
              activityType === 'walking' && styles.activitySegmentBtnActive,
            ]}
            onPress={() => setActivityType('walking')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.activitySegmentText,
                activityType === 'walking' && styles.activitySegmentTextActive,
              ]}
            >
              🚶‍♂️ Marche
            </Text>
          </TouchableOpacity>
        </View>

        {/* Module Chronomètre en Direct */}
        <Card style={styles.liveTimerCard}>
          <View style={styles.timerHeaderRow}>
            <View style={styles.timerBadge}>
              <View style={[styles.liveDot, isTimerRunning && styles.liveDotActive]} />
              <Text style={styles.timerBadgeText}>
                {isTimerRunning
                  ? activityType === 'walking'
                    ? 'MARCHE EN DIRECT'
                    : 'COURSE EN DIRECT'
                  : activityType === 'walking'
                  ? 'CHRONOMÈTRE DE MARCHE'
                  : 'CHRONOMÈTRE DE SORTIE'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {timerSeconds > 0 && (
                <View style={styles.liveTimerXpPill}>
                  <Text style={styles.liveTimerXpText}>
                    ⚡ ~{calculateRunningSessionXp(0, timerSeconds, activityType === 'walking')} XP
                  </Text>
                </View>
              )}
              <Text style={styles.livePaceEstimate}>
                {timerSeconds > 0 ? formatDuration(timerSeconds) : 'Prêt'}
              </Text>
            </View>
          </View>

          <Text style={styles.timerBigDisplay}>{formatTimerDisplay(timerSeconds)}</Text>

          <View style={styles.timerButtonsRow}>
            {!isTimerRunning ? (
              <Button
                title={
                  timerSeconds > 0
                    ? 'Reprendre ▶'
                    : activityType === 'walking'
                    ? 'Démarrer la marche ▶'
                    : 'Démarrer la course ▶'
                }
                variant="primary"
                size="md"
                onPress={handleStartTimer}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title="Pause ⏸"
                variant="secondary"
                size="md"
                onPress={handlePauseTimer}
                style={{ flex: 1 }}
              />
            )}

            {timerSeconds > 0 && (
              <>
                <Button
                  title="Valider 🏁"
                  variant="success"
                  size="md"
                  onPress={handleStopAndSave}
                  style={{ flex: 1 }}
                />
                <TouchableOpacity
                  style={styles.resetTimerBtn}
                  onPress={handleResetTimer}
                >
                  <Text style={styles.resetTimerText}>✕</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Card>

        {/* Résumé XP Course & Marche */}
        <View style={styles.xpSummaryBanner}>
          <View style={styles.xpSummaryIconWrapper}>
            <Text style={styles.xpSummaryIcon}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.xpSummaryValue}>{stats.totalXpEarned || 0}</Text>
              <Text style={styles.xpSummaryUnit}>XP GAGNÉS</Text>
            </View>
            <Text style={styles.xpSummaryLabel}>
              Expérience cumulée créditée sur votre rang et ligue athlète
            </Text>
          </View>
          <View style={styles.xpSummaryBadge}>
            <Text style={styles.xpSummaryBadgeText}>
              {stats.totalSessions} {stats.totalSessions > 1 ? 'sorties' : 'sortie'}
            </Text>
          </View>
        </View>

        {/* 4 Cartes Métriques Clés */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricCardIcon}>📍</Text>
            <Text style={styles.metricCardValue}>{stats.totalDistanceKm} km</Text>
            <Text style={styles.metricCardLabel}>Distance Totale</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardIcon}>⚡</Text>
            <Text style={styles.metricCardValue}>
              {stats.bestPaceSecondsPerKm > 0
                ? formatPace(stats.bestPaceSecondsPerKm).replace(' / km', '')
                : '--\'--"'}
            </Text>
            <Text style={styles.metricCardLabel}>Meilleure Allure</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardIcon}>⏳</Text>
            <Text style={styles.metricCardValue}>
              {formatDuration(stats.totalDurationSeconds)}
            </Text>
            <Text style={styles.metricCardLabel}>Temps Cumulé</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricCardIcon}>🎯</Text>
            <Text style={styles.metricCardValue}>
              {stats.averagePaceSecondsPerKm > 0
                ? formatPace(stats.averagePaceSecondsPerKm).replace(' / km', '')
                : '--\'--"'}
            </Text>
            <Text style={styles.metricCardLabel}>Allure Moyenne</Text>
          </View>
        </View>

        {/* Section Graphique d'Évolution des Performances */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Évolution des Performances</Text>
          <Text style={styles.sectionSubtitle}>
            Suivi des temps au km, vitesses et progression au fil de vos sorties
          </Text>
        </View>

        <RunningProgressChart sessions={sessions} />

        {/* Section Historique des Courses */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>
            📜 Historique des Sorties ({sessions.length})
          </Text>
        </View>

        {sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👟</Text>
            <Text style={styles.emptyCardTitle}>Aucune sortie enregistrée</Text>
            <Text style={styles.emptyCardSub}>
              Enfilez vos baskets et lancez le chronomètre ci-dessus ou notez votre course manuellement avec le bouton « + Saisie ».
            </Text>
          </Card>
        ) : (
          sessions.map((sess) => {
            const dateStr = new Date(sess.date).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            const speedKmh =
              sess.duration_seconds > 0
                ? ((sess.distance_km / sess.duration_seconds) * 3600).toFixed(1)
                : '0';

            return (
              <Card key={sess.id} style={styles.sessionCard}>
                <View style={styles.sessionCardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sessionDateRow}>
                      <Text style={styles.sessionDateBadge}>{dateStr}</Text>
                      <Text style={styles.sessionPaceBadge}>
                        ⏱ {formatPace(sess.pace_seconds_per_km)}
                      </Text>
                      <Text style={styles.sessionXpBadge}>
                        ⚡ +{sess.xp_earned ?? calculateRunningSessionXp(sess.distance_km, sess.duration_seconds, Boolean(sess.notes?.includes('[Marche]')))} XP
                      </Text>
                    </View>
                    <Text style={styles.sessionDistanceBig}>
                      {sess.distance_km} <Text style={{ fontSize: 16 }}>km</Text>
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteSessionBtn}
                    onPress={() => handleDeleteSession(sess.id, sess.distance_km)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.deleteSessionText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sessionStatsDivider} />

                <View style={styles.sessionStatsBottom}>
                  <Text style={styles.sessionStatItem}>
                    ⏳ {formatDuration(sess.duration_seconds)}
                  </Text>
                  <Text style={styles.sessionStatItem}>🚀 {speedKmh} km/h</Text>
                  <Text style={styles.sessionStatItem}>🔥 ~{sess.calories} kcal</Text>
                </View>

                {sess.notes ? (
                  <Text style={styles.sessionNotes}>💭 « {sess.notes} »</Text>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Modal Fin de Course en direct */}
      <Modal
        visible={finishModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFinishModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🏁 Enregistrer votre sortie</Text>
            <Text style={styles.modalSubtitle}>
              Temps réalisé : {formatDuration(timerSeconds)}. Indiquez la distance parcourue.
            </Text>

            <Text style={styles.inputLabel}>Distance parcourue (en kilomètres)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 5.5 ou 10"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={distanceInput}
              onChangeText={setDistanceInput}
              autoFocus
            />

            {/* Aperçu du gain XP */}
            <View style={styles.modalXpPreview}>
              <Text style={styles.modalXpPreviewIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalXpPreviewTitle}>
                  Gain estimé : +{calculateRunningSessionXp(
                    parseFloat(distanceInput.replace(',', '.')) || 0,
                    timerSeconds,
                    activityType === 'walking'
                  )} XP
                </Text>
                <Text style={styles.modalXpPreviewSub}>
                  Crédité sur votre rang athlète (+ 100 XP bonus si 1ère séance du jour)
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Notes / Sensations (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, { height: 65, textAlignVertical: 'top' }]}
              placeholder="Ex: Bonnes sensations, fractionné en côte..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={notesInput}
              onChangeText={setNotesInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setFinishModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={savingLoading ? 'Enregistrement...' : 'Sauvegarder ✅'}
                variant="primary"
                size="md"
                onPress={handleSaveTimerSession}
                disabled={savingLoading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Saisie Manuelle */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📝 Saisie manuelle d’une sortie</Text>
            <Text style={styles.modalSubtitle}>
              Ajoutez une course réalisée pour enrichir votre graphique de progression.
            </Text>

            <Text style={styles.inputLabel}>Distance (km)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 8.2"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={distanceInput}
              onChangeText={setDistanceInput}
            />

            <Text style={styles.inputLabel}>Durée (minutes et secondes)</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Minutes (ex: 42)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={minutesInput}
                onChangeText={setMinutesInput}
              />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Secondes (ex: 30)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={secondsInput}
                onChangeText={setSecondsInput}
              />
            </View>

            {/* Aperçu du gain XP */}
            <View style={styles.modalXpPreview}>
              <Text style={styles.modalXpPreviewIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalXpPreviewTitle}>
                  Gain estimé : +{calculateRunningSessionXp(
                    parseFloat(distanceInput.replace(',', '.')) || 0,
                    (parseInt(minutesInput, 10) || 0) * 60 + (parseInt(secondsInput, 10) || 0),
                    activityType === 'walking'
                  )} XP
                </Text>
                <Text style={styles.modalXpPreviewSub}>
                  Crédité sur votre rang athlète (+ 100 XP bonus si 1ère séance du jour)
                </Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Notes / Sensations (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Ex: Footing matinal sous le soleil..."
              placeholderTextColor={Colors.textMuted}
              multiline
              value={notesInput}
              onChangeText={setNotesInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setManualModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={savingLoading ? 'Enregistrement...' : 'Valider ✅'}
                variant="primary"
                size="md"
                onPress={handleSaveManualSession}
                disabled={savingLoading}
                style={{ flex: 1 }}
              />
            </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: '#090E1A',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  manualEntryBtn: {
    backgroundColor: '#00E5FF22',
    borderWidth: 1,
    borderColor: '#00E5FF66',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  manualEntryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  activitySegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 6,
  },
  activitySegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activitySegmentBtnActive: {
    backgroundColor: '#00E5FF22',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  activitySegmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  activitySegmentTextActive: {
    color: '#00E5FF',
  },
  liveTimerCard: {
    backgroundColor: '#0E1726',
    borderWidth: 1.5,
    borderColor: '#00E5FF44',
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
  },
  timerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  liveDotActive: {
    backgroundColor: Colors.success,
  },
  timerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  livePaceEstimate: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  liveTimerXpPill: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: '#F59E0B55',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveTimerXpText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  timerBigDisplay: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    marginVertical: 10,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  resetTimerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetTimerText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  metricCardIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  metricCardLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  sessionCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  sessionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sessionDateBadge: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sessionPaceBadge: {
    fontSize: 11,
    color: '#00E5FF',
    backgroundColor: '#00E5FF18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '700',
  },
  sessionDistanceBig: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.text,
  },
  deleteSessionBtn: {
    padding: 6,
  },
  deleteSessionText: {
    fontSize: 16,
    opacity: 0.6,
  },
  sessionStatsDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 10,
  },
  sessionStatsBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionStatItem: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  sessionNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    backgroundColor: '#0D1117',
    padding: 8,
    borderRadius: 8,
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 16,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#2D3748',
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  xpSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B44',
    borderWidth: 1,
    borderColor: '#6366F155',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  xpSummaryIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#6366F122',
    borderWidth: 1,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpSummaryIcon: {
    fontSize: 22,
  },
  xpSummaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#A5B4FC',
  },
  xpSummaryUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  xpSummaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  xpSummaryBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  xpSummaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  sessionXpBadge: {
    fontSize: 11,
    color: '#F59E0B',
    backgroundColor: '#F59E0B18',
    borderWidth: 1,
    borderColor: '#F59E0B44',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '800',
  },
  modalXpPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B55',
    borderWidth: 1,
    borderColor: '#6366F166',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  modalXpPreviewIcon: {
    fontSize: 20,
  },
  modalXpPreviewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A5B4FC',
  },
  modalXpPreviewSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
