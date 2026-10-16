import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  BodyWeightLog,
  FitnessGoal,
  WeightProgressStats,
  Exercise,
} from '../../types';
import {
  getAllWeightLogs,
  addWeightLog,
  deleteWeightLog,
  getWeightStats,
} from '../../database/weightRepository';
import {
  getAllGoals,
  getTargetWeightGoal,
  setTargetWeightGoal,
  createGoal,
  deleteGoal,
  syncGoalsWithUserRecords,
} from '../../database/goalRepository';
import { getAllExercises } from '../../database/exerciseRepository';
import { useSettingsStore } from '../../stores/settingsStore';

interface WeightGoalsViewProps {
  onWeightUpdated?: () => void;
}

export const WeightGoalsView: React.FC<WeightGoalsViewProps> = ({ onWeightUpdated }) => {
  const { user_height_cm, weight_unit } = useSettingsStore();

  const [logs, setLogs] = useState<BodyWeightLog[]>([]);
  const [stats, setStats] = useState<WeightProgressStats | null>(null);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [weightGoal, setWeightGoal] = useState<FitnessGoal | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Modales
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [noteInput, setNoteInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');

  const getTodayString = () => new Date().toISOString().slice(0, 10);
  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const handleOpenAddLog = () => {
    setEditingLogId(null);
    setWeightInput(stats?.currentWeight ? `${stats.currentWeight}` : '');
    setDateInput(getTodayString());
    setDateMode('today');
    setNoteInput('');
    setBodyFatInput('');
    setLogModalVisible(true);
  };

  const handleEditLog = (item: BodyWeightLog) => {
    setEditingLogId(item.id);
    setWeightInput(`${item.weight}`);
    setDateInput(item.date);
    const today = getTodayString();
    const yesterday = getYesterdayString();
    if (item.date === today) {
      setDateMode('today');
    } else if (item.date === yesterday) {
      setDateMode('yesterday');
    } else {
      setDateMode('custom');
    }
    setNoteInput(item.note || '');
    setBodyFatInput(item.body_fat_percentage ? `${item.body_fat_percentage}` : '');
    setLogModalVisible(true);
  };

  const [weightGoalModalVisible, setWeightGoalModalVisible] = useState(false);
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [startingWeightInput, setStartingWeightInput] = useState('');

  const [strengthGoalModalVisible, setStrengthGoalModalVisible] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [targetStrengthWeightInput, setTargetStrengthWeightInput] = useState('');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      await syncGoalsWithUserRecords();

      const [allLogs, weightSt, allGoals, targetGoal, allEx] = await Promise.all([
        getAllWeightLogs(),
        getWeightStats(user_height_cm),
        getAllGoals(),
        getTargetWeightGoal(),
        getAllExercises(),
      ]);

      setLogs(allLogs);
      setStats(weightSt);
      setGoals(allGoals.filter((g) => g.category !== 'weight'));
      setWeightGoal(targetGoal);
      setExercises(allEx);

      if (allEx.length > 0 && !selectedExerciseId) {
        const defaultEx = allEx.find((e) => e.id === 'ex_bench_press') || allEx[0];
        setSelectedExerciseId(defaultEx.id);
      }
    } catch (err) {
      console.error('Erreur chargement suivi poids & objectifs:', err);
    }
  }, [user_height_cm, selectedExerciseId]);

  const filteredExercisesForGoal = useMemo(() => {
    if (!exerciseSearchQuery.trim()) return exercises;
    const q = exerciseSearchQuery.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.target_muscle.toLowerCase().includes(q)
    );
  }, [exercises, exerciseSearchQuery]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (isMounted) {
        await loadData();
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  // Ajouter ou modifier une pesée historisée
  const handleSaveLog = async () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(val) || val <= 20 || val >= 300) {
      Alert.alert('Poids invalide', 'Veuillez saisir un poids valide en kg (ex: 78.5).');
      return;
    }

    const trimmedDate = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert(
        'Date invalide',
        'Veuillez saisir une date au format AAAA-MM-JJ (ex: 2026-10-15).'
      );
      return;
    }

    const bodyFat = bodyFatInput ? parseFloat(bodyFatInput.replace(',', '.')) : undefined;

    await addWeightLog(
      val,
      trimmedDate,
      noteInput,
      isNaN(bodyFat || NaN) ? undefined : bodyFat
    );
    setLogModalVisible(false);
    setEditingLogId(null);
    setWeightInput('');
    setNoteInput('');
    setBodyFatInput('');
    await loadData();
    onWeightUpdated?.();
  };

  // Supprimer une pesée
  const handleDeleteLog = (id: string, weight: number, date: string) => {
    Alert.alert(
      'Supprimer cette pesée',
      `Voulez-vous supprimer la pesée de ${weight} kg du ${date} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteWeightLog(id);
            await loadData();
            onWeightUpdated?.();
          },
        },
      ]
    );
  };

  // Enregistrer objectif de poids
  const handleSaveWeightGoal = async () => {
    const target = parseFloat(targetWeightInput.replace(',', '.'));
    if (isNaN(target) || target <= 25 || target >= 250) {
      Alert.alert('Objectif invalide', 'Veuillez entrer un poids cible réaliste.');
      return;
    }

    const starting = startingWeightInput
      ? parseFloat(startingWeightInput.replace(',', '.'))
      : stats?.currentWeight ?? target;

    await setTargetWeightGoal(target, starting);
    setWeightGoalModalVisible(false);
    setTargetWeightInput('');
    setStartingWeightInput('');
    await loadData();
    onWeightUpdated?.();
  };

  // Enregistrer objectif de force
  const handleSaveStrengthGoal = async () => {
    const target = parseFloat(targetStrengthWeightInput.replace(',', '.'));
    if (isNaN(target) || target <= 0) {
      Alert.alert('Charge invalide', 'Veuillez entrer une charge cible valide (ex: 100 kg).');
      return;
    }

    const ex = exercises.find((e) => e.id === selectedExerciseId);
    const title = ex ? `${ex.name} à ${target} kg` : `Objectif ${target} kg`;

    await createGoal({
      title,
      category: 'exercise',
      target_value: target,
      starting_value: 0,
      unit: weight_unit,
      exercise_id: selectedExerciseId,
    });

    setStrengthGoalModalVisible(false);
    setTargetStrengthWeightInput('');
    await loadData();
  };

  // Supprimer un objectif
  const handleDeleteGoal = (id: string, title: string) => {
    Alert.alert('Supprimer cet objectif', `Voulez-vous supprimer « ${title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(id);
          await loadData();
        },
      },
    ]);
  };

  // Calcul progression objectif de poids
  const weightGoalProgress = useMemo(() => {
    if (!weightGoal || !stats?.currentWeight) return null;

    const start = weightGoal.starting_value;
    const target = weightGoal.target_value;
    const current = stats.currentWeight;

    const isLosing = start > target;
    const totalDiff = Math.abs(start - target);
    const currentDiff = isLosing ? start - current : current - start;
    const remainingKg = Math.abs(current - target);

    let percent = totalDiff > 0 ? (currentDiff / totalDiff) * 100 : 0;
    percent = Math.max(0, Math.min(100, Math.round(percent)));

    const achieved = isLosing ? current <= target : current >= target;

    return {
      percent,
      isLosing,
      remainingKg: Math.round(remainingKg * 10) / 10,
      achieved,
    };
  }, [weightGoal, stats]);

  // Données de graphique (10 dernières pesées inversées chronologiquement)
  const chartLogs = useMemo(() => {
    return [...logs].slice(0, 12).reverse();
  }, [logs]);

  return (
    <View style={styles.container}>
      {/* 1. CARTE RÉSUMÉ DU POIDS */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summaryLabel}>Poids Actuel</Text>
            <View style={styles.weightValueRow}>
              <Text style={styles.currentWeightNumber}>
                {stats?.currentWeight ? `${stats.currentWeight}` : '--'}
              </Text>
              <Text style={styles.weightUnitText}>{weight_unit}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addLogBtn}
            onPress={handleOpenAddLog}
            activeOpacity={0.8}
          >
            <Text style={styles.addLogBtnIcon}>⚖️</Text>
            <Text style={styles.addLogBtnText}>+ Pesée</Text>
          </TouchableOpacity>
        </View>

        {/* Ligne d'indicateurs rapides */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemLabel}>Évolution totale</Text>
            <Text
              style={[
                styles.metricItemValue,
                stats && stats.deltaTotal > 0 && styles.deltaPositive,
                stats && stats.deltaTotal < 0 && styles.deltaNegative,
              ]}
            >
              {stats && stats.currentWeight !== null
                ? `${stats.deltaTotal > 0 ? '+' : ''}${stats.deltaTotal} kg`
                : '--'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricItemLabel}>Sur 7 jours</Text>
            <Text
              style={[
                styles.metricItemValue,
                stats && stats.delta7Days > 0 && styles.deltaPositive,
                stats && stats.delta7Days < 0 && styles.deltaNegative,
              ]}
            >
              {stats && stats.delta7Days !== 0
                ? `${stats.delta7Days > 0 ? '+' : ''}${stats.delta7Days} kg`
                : 'Stable'}
            </Text>
          </View>

          {stats?.bmi !== null && stats?.bmi !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricItemLabel}>IMC estimé</Text>
              <Text style={styles.metricItemValue}>{stats.bmi}</Text>
            </View>
          )}

          <View style={styles.metricItem}>
            <Text style={styles.metricItemLabel}>Pesées</Text>
            <Text style={styles.metricItemValue}>{stats?.logsCount ?? 0}</Text>
          </View>
        </View>
      </Card>

      {/* 2. MINI-GRAPHIQUE HISTORIQUE VECTORIEL DES DERNIÈRES PESÉES */}
      {chartLogs.length > 1 && (
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Tendance des pesées</Text>
            <Text style={styles.chartSub}>
              {chartLogs.length} dernières pesées
            </Text>
          </View>

          <View style={styles.chartContainer}>
            {(() => {
              const weights = chartLogs.map((l) => l.weight);
              const minW = Math.min(...weights) - 0.5;
              const maxW = Math.max(...weights) + 0.5;
              const range = Math.max(1, maxW - minW);

              return (
                <View style={styles.barsRow}>
                  {chartLogs.map((item, idx) => {
                    const heightPercent = Math.max(15, Math.min(100, ((item.weight - minW) / range) * 100));
                    const isLatest = idx === chartLogs.length - 1;

                    return (
                      <View key={item.id} style={styles.barCol}>
                        <Text style={[styles.barWeightText, isLatest && styles.barWeightTextLatest]}>
                          {item.weight}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${heightPercent}%` },
                              isLatest && styles.barFillLatest,
                            ]}
                          />
                        </View>
                        <Text style={styles.barDateText}>
                          {item.date.slice(5)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </Card>
      )}

      {/* 3. SECTION OBJECTIF DE POIDS CORPOREL */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🎯 Objectif de Poids</Text>
        <TouchableOpacity
          onPress={() => {
            setTargetWeightInput(weightGoal ? `${weightGoal.target_value}` : '');
            setStartingWeightInput(
              weightGoal ? `${weightGoal.starting_value}` : stats?.currentWeight ? `${stats.currentWeight}` : ''
            );
            setWeightGoalModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionActionText}>
            {weightGoal ? 'Modifier ❯' : '+ Définir ❯'}
          </Text>
        </TouchableOpacity>
      </View>

      {weightGoal ? (
        <Card style={styles.goalCard}>
          <View style={styles.goalCardHeader}>
            <View style={styles.goalIconCircle}>
              <Text style={{ fontSize: 20 }}>
                {weightGoalProgress?.achieved ? '🏆' : '⚖️'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.goalBadgeRow}>
                <Badge
                  label={weightGoalProgress?.isLosing ? 'Sèche / Perte' : 'Prise de masse'}
                  color="rgba(59, 130, 246, 0.2)"
                  textColor="#60A5FA"
                />
                {weightGoalProgress?.achieved && (
                  <Badge
                    label="🎉 Objectif Atteint !"
                    color="rgba(34, 197, 94, 0.25)"
                    textColor="#4ADE80"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
              <Text style={styles.goalTitle}>
                Cible : {weightGoal.target_value} kg
              </Text>
            </View>
          </View>

          {/* Jauge de progression */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${weightGoalProgress?.percent ?? 0}%` },
                weightGoalProgress?.achieved && { backgroundColor: '#10B981' },
              ]}
            />
          </View>

          <View style={styles.goalFooterRow}>
            <Text style={styles.goalFooterSub}>
              Départ : {weightGoal.starting_value} kg • Actuel : {stats?.currentWeight ?? '--'} kg
            </Text>
            <Text style={styles.goalFooterPercent}>
              {weightGoalProgress?.percent}%
            </Text>
          </View>

          {!weightGoalProgress?.achieved && (
            <Text style={styles.goalRemainingText}>
              Encore {weightGoalProgress?.remainingKg} kg pour valider votre objectif !
            </Text>
          )}
        </Card>
      ) : (
        <Card style={styles.emptyGoalCard}>
          <Text style={{ fontSize: 26, marginBottom: 6 }}>🎯</Text>
          <Text style={styles.emptyGoalTitle}>Aucun objectif de poids fixé</Text>
          <Text style={styles.emptyGoalSub}>
            Définissez un poids cible pour suivre votre progression pas à pas.
          </Text>
          <Button
            title="+ Définir un poids cible"
            variant="outline"
            size="sm"
            onPress={() => {
              setTargetWeightInput('');
              setStartingWeightInput(stats?.currentWeight ? `${stats.currentWeight}` : '');
              setWeightGoalModalVisible(true);
            }}
            style={{ marginTop: 10 }}
          />
        </Card>
      )}

      {/* 4. SECTION OBJECTIFS DE FORCE & MUSCULATION */}
      <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>💪 Objectifs de Force</Text>
        <TouchableOpacity
          onPress={() => setStrengthGoalModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionActionText}>+ Nouvel objectif ❯</Text>
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <Card style={styles.emptyGoalCard}>
          <Text style={{ fontSize: 24, marginBottom: 6 }}>🏋️</Text>
          <Text style={styles.emptyGoalTitle}>Aucun objectif de force</Text>
          <Text style={styles.emptyGoalSub}>
            Ajoutez un palier de charge (ex: Développé couché à 100 kg) synchronisé automatiquement avec vos séances.
          </Text>
          <Button
            title="+ Ajouter un palier de charge"
            variant="outline"
            size="sm"
            onPress={() => setStrengthGoalModalVisible(true)}
            style={{ marginTop: 10 }}
          />
        </Card>
      ) : (
        goals.map((goal) => {
          const percent = Math.min(
            100,
            Math.round((goal.current_value / goal.target_value) * 100)
          );
          const isDone = goal.completed === 1 || percent >= 100;

          return (
            <Card key={goal.id} style={styles.strengthGoalCard}>
              <View style={styles.strengthGoalTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.strengthGoalName}>
                      {goal.exercise_name || goal.title}
                    </Text>
                    {isDone && (
                      <Badge
                        label="🏆 Validé !"
                        color="rgba(34, 197, 94, 0.25)"
                        textColor="#4ADE80"
                      />
                    )}
                  </View>
                  <Text style={styles.strengthGoalNumbers}>
                    Actuel : {goal.current_value} {goal.unit} ➔ Cible : {goal.target_value} {goal.unit}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteGoal(goal.id, goal.exercise_name || goal.title)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteGoalBtn}
                >
                  <Text style={styles.deleteGoalIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${percent}%` },
                    isDone && { backgroundColor: '#10B981' },
                  ]}
                />
              </View>

              <View style={styles.goalFooterRow}>
                <Text style={styles.goalFooterSub}>
                  {isDone ? 'Charge atteinte avec succès !' : `Plus que ${Math.round((goal.target_value - goal.current_value) * 10) / 10} ${goal.unit} !`}
                </Text>
                <Text style={styles.goalFooterPercent}>{percent}%</Text>
              </View>
            </Card>
          );
        })
      )}

      {/* 5. HISTORIQUE DÉTAILLÉ DES PESÉES */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>📋 Historique des Pesées</Text>
        <Text style={styles.logsCountHint}>{logs.length} entrée{logs.length > 1 ? 's' : ''}</Text>
      </View>

      {logs.length === 0 ? (
        <Card style={styles.emptyGoalCard}>
          <Text style={styles.emptyGoalSub}>
            Aucune pesée enregistrée. Appuyez sur « + Pesée » pour débuter votre suivi.
          </Text>
        </Card>
      ) : (
        logs.map((item, index) => {
          const prevItem = logs[index + 1];
          const delta = prevItem ? Math.round((item.weight - prevItem.weight) * 10) / 10 : null;

          return (
            <Card key={item.id} style={styles.logItemCard}>
              <View style={styles.logItemRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleEditLog(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.logItemWeight}>
                      {item.weight} {weight_unit}
                    </Text>
                    {item.body_fat_percentage && (
                      <Badge
                        label={`${item.body_fat_percentage}% MG`}
                        color="rgba(6, 182, 212, 0.15)"
                        textColor="#06B6D4"
                      />
                    )}
                    {delta !== null && delta !== 0 && (
                      <Badge
                        label={`${delta > 0 ? '+' : ''}${delta} kg`}
                        color={delta > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'}
                        textColor={delta > 0 ? '#F87171' : '#4ADE80'}
                      />
                    )}
                  </View>
                  <Text style={styles.logItemDate}>
                    {item.date} {item.note ? `• ${item.note}` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleEditLog(item)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.deleteLogBtn, { marginRight: 6 }]}
                >
                  <Text style={styles.deleteLogIcon}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteLog(item.id, item.weight, item.date)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.deleteLogBtn}
                >
                  <Text style={styles.deleteLogIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      )}

      {/* MODAL : NOUVELLE PESÉE / MODIFICATION AVEC CHOIX DE DATE */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingLogId ? '✏️ Modifier la pesée' : '⚖️ Enregistrer votre poids'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {editingLogId
                ? 'Modifiez votre relevé pour cette date précise.'
                : 'Chaque date saisie est historisée pour tracer l’évolution de votre poids.'}
            </Text>

            {/* Sélecteur de date de pesée */}
            <Text style={styles.inputLabel}>Date de la pesée *</Text>
            <View style={styles.dateChipsRow}>
              <TouchableOpacity
                style={[styles.dateChip, dateMode === 'today' && styles.dateChipActive]}
                onPress={() => {
                  setDateMode('today');
                  setDateInput(getTodayString());
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateChipText, dateMode === 'today' && styles.dateChipTextActive]}>
                  {"Aujourd'hui"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateChip, dateMode === 'yesterday' && styles.dateChipActive]}
                onPress={() => {
                  setDateMode('yesterday');
                  setDateInput(getYesterdayString());
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateChipText, dateMode === 'yesterday' && styles.dateChipTextActive]}>
                  Hier
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateChip, dateMode === 'custom' && styles.dateChipActive]}
                onPress={() => setDateMode('custom')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateChipText, dateMode === 'custom' && styles.dateChipTextActive]}>
                  Autre date
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="AAAA-MM-JJ (ex: 2026-10-15)"
              placeholderTextColor={Colors.textMuted}
              value={dateInput}
              onChangeText={(txt) => {
                setDateInput(txt);
                setDateMode('custom');
              }}
              maxLength={10}
            />
            <Text style={styles.dateHelperText}>
              📅 Format : AAAA-MM-JJ. Les pesées à dates distinctes sont toutes conservées.
            </Text>

            {/* Poids corporel */}
            <Text style={styles.inputLabel}>Poids corporel ({weight_unit}) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 78.5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
              autoFocus={!editingLogId}
            />

            {/* Taux de masse grasse */}
            <Text style={styles.inputLabel}>Masse grasse % (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 14.5"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={bodyFatInput}
              onChangeText={setBodyFatInput}
            />

            {/* Note */}
            <Text style={styles.inputLabel}>Note (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: À jeun au réveil, après entraînement..."
              placeholderTextColor={Colors.textMuted}
              value={noteInput}
              onChangeText={setNoteInput}
              maxLength={40}
            />

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setLogModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={editingLogId ? 'Mettre à jour' : 'Enregistrer'}
                variant="primary"
                size="md"
                onPress={handleSaveLog}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL : OBJECTIF DE POIDS */}
      <Modal
        visible={weightGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightGoalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎯 Objectif de Poids Corporel</Text>
            <Text style={styles.modalSubtitle}>
              Fixez un poids cible vers lequel orienter vos efforts d’entraînement et de nutrition.
            </Text>

            <Text style={styles.inputLabel}>Poids cible ({weight_unit}) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 75.0 pour une sèche, ou 82.0 pour une prise"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={targetWeightInput}
              onChangeText={setTargetWeightInput}
              autoFocus
            />

            <Text style={styles.inputLabel}>Poids de départ ({weight_unit})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 80.0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={startingWeightInput}
              onChangeText={setStartingWeightInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setWeightGoalModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Enregistrer"
                variant="primary"
                size="md"
                onPress={handleSaveWeightGoal}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL : NOUVEL OBJECTIF DE FORCE */}
      <Modal
        visible={strengthGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStrengthGoalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>💪 Nouvel Objectif de Force</Text>
            <Text style={styles.modalSubtitle}>
              Choisissez un exercice et fixez la charge que vous visez à soulever.
            </Text>

            <Text style={styles.inputLabel}>Exercice concerné</Text>

            {/* Barre de recherche d'exercice */}
            <View style={styles.exerciseSearchBox}>
              <TextInput
                style={styles.exerciseSearchField}
                placeholder="🔍 Rechercher (ex: Développé, Squat, Tirage...)"
                placeholderTextColor={Colors.textMuted}
                value={exerciseSearchQuery}
                onChangeText={setExerciseSearchQuery}
                autoCapitalize="none"
              />
              {exerciseSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setExerciseSearchQuery('')}
                  style={styles.clearSearchBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
              {filteredExercisesForGoal.length === 0 ? (
                <Text style={styles.noExerciseFoundText}>
                  Aucun exercice trouvé pour « {exerciseSearchQuery} »
                </Text>
              ) : (
                filteredExercisesForGoal.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.exerciseChoicePill,
                      selectedExerciseId === ex.id && styles.exerciseChoicePillActive,
                    ]}
                    onPress={() => setSelectedExerciseId(ex.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.exerciseChoiceText,
                          selectedExerciseId === ex.id && styles.exerciseChoiceTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {ex.name}
                      </Text>
                      <Text style={styles.exerciseChoiceMuscleSub}>
                        {ex.target_muscle} • {ex.equipment_needed}
                      </Text>
                    </View>
                    {selectedExerciseId === ex.id && (
                      <Text style={{ color: Colors.primary, fontWeight: '800' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Text style={styles.inputLabel}>Charge cible ({weight_unit}) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 100"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={targetStrengthWeightInput}
              onChangeText={setTargetStrengthWeightInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setStrengthGoalModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Créer l’objectif"
                variant="primary"
                size="md"
                onPress={handleSaveStrengthGoal}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#121A28',
    borderColor: '#1E2B3E',
    marginBottom: 16,
    padding: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  weightValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  currentWeightNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  weightUnitText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 6,
  },
  addLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addLogBtnIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  addLogBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0A121E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#162232',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricItemLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  metricItemValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deltaPositive: {
    color: '#F87171',
  },
  deltaNegative: {
    color: '#4ADE80',
  },
  chartCard: {
    backgroundColor: '#111A29',
    borderColor: '#1D2A3E',
    marginBottom: 18,
    padding: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  chartSub: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  chartContainer: {
    height: 110,
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 90,
    paddingBottom: 4,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barWeightText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  barWeightTextLatest: {
    color: Colors.primary,
    fontWeight: '800',
  },
  barTrack: {
    height: 60,
    width: 14,
    backgroundColor: '#1A2536',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    width: '100%',
  },
  barFillLatest: {
    backgroundColor: Colors.primary,
  },
  barDateText: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionActionText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  logsCountHint: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  goalCard: {
    backgroundColor: '#131D2D',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    marginBottom: 14,
    padding: 14,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E2C44',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2F456A',
  },
  goalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#0E1724',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 5,
  },
  goalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalFooterSub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  goalFooterPercent: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  goalRemainingText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyGoalCard: {
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#111824',
  },
  emptyGoalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptyGoalSub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  strengthGoalCard: {
    backgroundColor: '#121B2B',
    marginBottom: 10,
    padding: 14,
  },
  strengthGoalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  strengthGoalName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  strengthGoalNumbers: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  deleteGoalBtn: {
    padding: 4,
    opacity: 0.6,
  },
  deleteGoalIcon: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  logItemCard: {
    backgroundColor: '#111927',
    marginBottom: 8,
    padding: 12,
  },
  logItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logItemWeight: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  logItemDate: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  deleteLogBtn: {
    padding: 6,
    opacity: 0.7,
  },
  deleteLogIcon: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#172131',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#293A54',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0F1622',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354F',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  exerciseSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1622',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354F',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  exerciseSearchField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  noExerciseFoundText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 14,
  },
  exerciseChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0D1420',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  exerciseChoicePillActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
  },
  exerciseChoiceText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  exerciseChoiceMuscleSub: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dateChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0D1420',
    borderWidth: 1,
    borderColor: '#25354F',
  },
  dateChipActive: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    borderColor: Colors.primary,
  },
  dateChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dateHelperText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
});
