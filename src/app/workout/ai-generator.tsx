import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { showAlert } from '../../utils/alert';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  TargetFocus,
  WorkoutTrainingType,
  TARGET_FOCUS_OPTIONS,
  TRAINING_TYPE_OPTIONS,
  GeneratedWorkoutPlan,
  GeneratedExercise,
} from '../../types/aiWorkout';
import { DifficultyLevel, Equipment } from '../../types';
import {
  generateWorkoutPlan,
  startGeneratedWorkout,
  saveGeneratedPlanAsProgram,
} from '../../services/aiWorkoutService';
import { EQUIPMENT_CATALOG_METADATA } from '../../utils/exerciseUnits';
import {
  getFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '../../services/favoritesService';
import { ExerciseGuideModal } from '../../components/workout/ExerciseGuideModal';

const DURATION_OPTIONS = [30, 45, 60, 75];
const DIFFICULTY_OPTIONS: DifficultyLevel[] = ['Débutant', 'Intermédiaire', 'Avancé'];

export default function AIWorkoutGeneratorScreen() {
  const { available_equipments } = useSettingsStore();

  // Filtres de sélection
  const [selectedTarget, setSelectedTarget] = useState<TargetFocus>('full_body');
  const [selectedTrainingType, setSelectedTrainingType] =
    useState<WorkoutTrainingType>('hypertrophy');
  const [selectedDuration, setSelectedDuration] = useState<number>(45);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyLevel>('Intermédiaire');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [selectedGuideExercise, setSelectedGuideExercise] = useState<{
    id: string;
    name: string;
    target_muscle?: string;
    equipment_needed?: string;
  } | null>(null);

  useEffect(() => {
    getFavoriteExerciseIds().then(setFavoriteIds);
  }, []);

  const handleToggleFavorite = async (exerciseId: string) => {
    await toggleFavoriteExercise(exerciseId);
    const updated = await getFavoriteExerciseIds();
    setFavoriteIds(updated);
  };

  // Matériel sélectionné (par défaut ceux des préférences de l'utilisateur)
  const [equipments, setEquipments] = useState<Equipment[]>(
    (available_equipments as Equipment[]) || []
  );

  // État de génération
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedWorkoutPlan | null>(null);
  const [savingProgram, setSavingProgram] = useState(false);

  const toggleEquipment = (eq: Equipment) => {
    if (equipments.includes(eq)) {
      if (equipments.length <= 1) {
        showAlert('Attention', 'Vous devez conserver au moins un équipement coché.');
        return;
      }
      setEquipments(equipments.filter((e) => e !== eq));
    } else {
      setEquipments([...equipments, eq]);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const plan = await generateWorkoutPlan({
        targetFocus: selectedTarget,
        trainingType: selectedTrainingType,
        difficulty: selectedDifficulty,
        durationMinutes: selectedDuration,
        availableEquipments: equipments,
      });
      setGeneratedPlan(plan);
    } catch (err: any) {
      showAlert('Erreur de génération', err.message || 'Impossible de créer la séance.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async () => {
    if (!generatedPlan) return;
    try {
      await startGeneratedWorkout(generatedPlan);
      router.push('/workout/active');
    } catch (err: any) {
      showAlert('Erreur', 'Impossible de démarrer la séance : ' + err.message);
    }
  };

  const handleSaveProgram = async () => {
    if (!generatedPlan) return;
    try {
      setSavingProgram(true);
      const progId = await saveGeneratedPlanAsProgram(generatedPlan);
      showAlert(
        'Programme enregistré !',
        'Votre séance a été sauvegardée dans vos programmes personnalisés.',
        [
          { text: 'Rester ici', style: 'cancel' },
          {
            text: 'Voir le programme',
            onPress: () => router.push(`/programs/${progId}`),
          },
        ]
      );
    } catch (err: any) {
      showAlert('Erreur', 'Impossible d’enregistrer le programme : ' + err.message);
    } finally {
      setSavingProgram(false);
    }
  };

  const getPhaseBadge = (phase: GeneratedExercise['phase']) => {
    switch (phase) {
      case 'warmup':
        return { label: 'ÉCHAUFFEMENT & ACTIVATION', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.15)' };
      case 'compound':
        return { label: 'POLYARTICULAIRE MAJEUR', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'isolation':
        return { label: 'ISOLATION & CONGESTION', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'cooldown':
        return { label: 'GAINAGE & RETOUR AU CALME', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* En-tête de l'IA */}
        <View style={styles.headerBox}>
          <View style={styles.aiPill}>
            <Text style={styles.aiPillEmoji}>🤖</Text>
            <Text style={styles.aiPillText}>SCIENCE DU SPORT & IA VITAX</Text>
          </View>
          <Text style={styles.mainTitle}>Générateur de Séances Sur Mesure</Text>
          <Text style={styles.subtitle}>
            Concevez une routine optimisée selon vos objectifs biomécaniques, votre niveau et votre matériel.
          </Text>
        </View>

        {!generatedPlan ? (
          /* Formulaire de configuration IA */
          <View>
            {/* 1. ZONE & FOCUS MUSCULAIRE */}
            <Text style={styles.sectionTitle}>1. Zone & Groupe musculaire ciblé</Text>
            <View style={styles.targetGrid}>
              {TARGET_FOCUS_OPTIONS.map((opt) => {
                const isSelected = selectedTarget === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.targetCard, isSelected && styles.targetCardActive]}
                    onPress={() => setSelectedTarget(opt.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.targetEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.targetLabel, isSelected && styles.targetLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. OBJECTIF D'ENTRAÎNEMENT */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              {"2. Objectif & Type d'entraînement"}
            </Text>
            <View style={styles.trainingTypeColumn}>
              {TRAINING_TYPE_OPTIONS.map((type) => {
                const isSelected = selectedTrainingType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.trainingCard, isSelected && styles.trainingCardActive]}
                    onPress={() => setSelectedTrainingType(type.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.trainingHeaderRow}>
                      <Text style={styles.trainingEmoji}>{type.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.trainingTitle,
                            isSelected && styles.trainingTitleActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                        <Text style={styles.trainingDesc}>{type.description}</Text>
                      </View>
                      <View
                        style={[
                          styles.trainingBadgeBox,
                          isSelected && styles.trainingBadgeBoxActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.trainingBadgeText,
                            isSelected && styles.trainingBadgeTextActive,
                          ]}
                        >
                          {type.repRange}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. DURÉE & NIVEAU */}
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>3. Durée</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((dur) => (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.durationPill,
                        selectedDuration === dur && styles.durationPillActive,
                      ]}
                      onPress={() => setSelectedDuration(dur)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          selectedDuration === dur && styles.durationTextActive,
                        ]}
                      >
                        {dur} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>4. Niveau</Text>
                <View style={styles.durationRow}>
                  {DIFFICULTY_OPTIONS.map((diff) => (
                    <TouchableOpacity
                      key={diff}
                      style={[
                        styles.durationPill,
                        selectedDifficulty === diff && styles.durationPillActive,
                      ]}
                      onPress={() => setSelectedDifficulty(diff)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          selectedDifficulty === diff && styles.durationTextActive,
                        ]}
                      >
                        {diff.substring(0, 5)}.
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* 5. MATÉRIEL ACCESSIBLE */}
            <View style={{ marginTop: 20 }}>
              <View style={styles.equipHeaderRow}>
                <Text style={styles.sectionTitle}>5. Matériel accessible</Text>
                <Text style={styles.equipCountText}>
                  {equipments.length}/13 équipement{equipments.length > 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.equipChipsWrap}>
                {EQUIPMENT_CATALOG_METADATA.map((meta) => {
                  const isChecked = equipments.includes(meta.key);
                  return (
                    <TouchableOpacity
                      key={meta.key}
                      style={[
                        styles.equipChip,
                        isChecked && styles.equipChipChecked,
                      ]}
                      onPress={() => toggleEquipment(meta.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.equipChipEmoji}>{meta.emoji}</Text>
                      <Text
                        style={[
                          styles.equipChipText,
                          isChecked && styles.equipChipTextChecked,
                        ]}
                      >
                        {meta.label}
                      </Text>
                      <Text style={styles.equipChipCheck}>
                        {isChecked ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* BOUTON D'ACTION PRINCIPAL */}
            <Button
              title="⚡ Générer ma séance personnalisée"
              variant="primary"
              size="lg"
              onPress={handleGenerate}
              loading={loading}
              style={{ marginTop: 24, marginBottom: 40 }}
            />
          </View>
        ) : (
          /* VUE DE LA SÉANCE GÉNÉRÉE PAR L'IA */
          <View>
            {/* Résumé du Plan */}
            <Card style={styles.planSummaryCard}>
              <View style={styles.planBadgeRow}>
                <Badge
                  label={generatedPlan.difficulty}
                  color="rgba(59, 130, 246, 0.2)"
                  textColor="#60A5FA"
                />
                <Badge
                  label={`${generatedPlan.estimated_duration_minutes} MIN`}
                  color="rgba(16, 185, 129, 0.2)"
                  textColor="#34D399"
                  style={{ marginLeft: 8 }}
                />
                <Badge
                  label="100% Hors-ligne certifié"
                  color="rgba(245, 158, 11, 0.2)"
                  textColor="#FBBF24"
                  style={{ marginLeft: 8 }}
                />
              </View>

              <Text style={styles.planTitle}>{generatedPlan.title}</Text>
              <Text style={styles.planSubtitle}>{generatedPlan.subtitle}</Text>

              <View style={styles.rationaleBox}>
                <Text style={styles.rationaleTitle}>🧬 Justification biomécanique :</Text>
                <Text style={styles.rationaleText}>
                  {generatedPlan.sports_science_rationale}
                </Text>
              </View>

              {/* Protocoles Échauffement & Retour au calme */}
              <View style={styles.protocolRow}>
                <View style={styles.protocolBox}>
                  <Text style={styles.protocolIcon}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.protocolTitle}>Échauffement</Text>
                    <Text style={styles.protocolText}>{generatedPlan.warmup_advice}</Text>
                  </View>
                </View>

                <View style={styles.protocolBox}>
                  <Text style={styles.protocolIcon}>🧊</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.protocolTitle}>Retour au calme</Text>
                    <Text style={styles.protocolText}>{generatedPlan.cooldown_advice}</Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Actions Rapides en haut */}
            <View style={styles.actionsTopRow}>
              <Button
                title="▶ Démarrer la séance immédiatement"
                variant="primary"
                size="md"
                onPress={handleStartWorkout}
                style={{ flex: 1 }}
              />
            </View>

            {/* Liste des Exercices par Phase Biomecanique */}
            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 12 }]}>
              Programme de la séance ({generatedPlan.exercises.length} exercices)
            </Text>

            {generatedPlan.exercises.map((ex, idx) => {
              const phaseBadge = getPhaseBadge(ex.phase);
              return (
                <Card key={idx} style={styles.exerciseCard}>
                  {/* Badge de phase biomécanique */}
                  <View style={styles.exerciseHeader}>
                    <View
                      style={[
                        styles.phaseBadge,
                        { backgroundColor: phaseBadge.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.phaseBadgeText,
                          { color: phaseBadge.color },
                        ]}
                      >
                        {phaseBadge.label}
                      </Text>
                    </View>
                    <View style={styles.exerciseHeaderRight}>
                      {/* Bouton guide technique / posture */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedGuideExercise({
                            id: ex.exercise_id || `gen-${idx}`,
                            name: ex.name,
                            target_muscle: ex.target_muscle,
                            equipment_needed: ex.equipment_needed,
                          });
                          setGuideModalVisible(true);
                        }}
                        style={styles.infoGuideBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.infoGuideIcon}>ℹ️</Text>
                      </TouchableOpacity>

                      {Boolean(ex.exercise_id) && (
                        <TouchableOpacity
                          onPress={() => handleToggleFavorite(ex.exercise_id!)}
                          style={[
                            styles.favoriteCardBtn,
                            favoriteIds.includes(ex.exercise_id!) && styles.favoriteCardBtnActive,
                          ]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.favoriteCardBtnIcon}>
                            {favoriteIds.includes(ex.exercise_id!) ? '⭐' : '☆'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.exerciseOrderText}>#{idx + 1}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.exerciseMainRow}
                    onPress={() => {
                      setSelectedGuideExercise({
                        id: ex.exercise_id || `gen-${idx}`,
                        name: ex.name,
                        target_muscle: ex.target_muscle,
                        equipment_needed: ex.equipment_needed,
                      });
                      setGuideModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <ExerciseIllustration
                      exerciseId={ex.exercise_id}
                      targetMuscle={ex.target_muscle}
                      size={60}
                    />

                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <View style={styles.tagsRow}>
                        <Badge
                          label={ex.target_muscle}
                          color="#1E293B"
                          textColor={Colors.textSecondary}
                        />
                        <Badge
                          label={ex.equipment_needed}
                          color="rgba(59, 130, 246, 0.15)"
                          textColor="#93C5FD"
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Grille des paramètres d'effort */}
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricVal}>{ex.sets}</Text>
                      <Text style={styles.metricLbl}>SÉRIES</Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricVal}>{ex.reps}</Text>
                      <Text style={styles.metricLbl}>VOLUME</Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricVal}>{ex.rest_seconds}s</Text>
                      <Text style={styles.metricLbl}>REPOS</Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.metricVal}>{ex.rpe}</Text>
                      <Text style={styles.metricLbl}>INTENSITÉ</Text>
                    </View>
                  </View>

                  {/* Tempo */}
                  <View style={styles.tempoRow}>
                    <Text style={styles.tempoLabel}>⏱ Tempo :</Text>
                    <Text style={styles.tempoValue}>{ex.tempo}</Text>
                  </View>

                  {/* Consigne technique clé */}
                  <View style={styles.tipBox}>
                    <Text style={styles.tipIcon}>💡</Text>
                    <Text style={styles.tipText}>{ex.execution_tip}</Text>
                  </View>

                  {/* Alternative */}
                  <View style={styles.altBox}>
                    <Text style={styles.altLabel}>🔄 Alternative :</Text>
                    <Text style={styles.altText}>{ex.alternative_exercise}</Text>
                  </View>
                </Card>
              );
            })}

            {/* Boutons d'Action Inférieurs */}
            <View style={styles.bottomActions}>
              <Button
                title="▶ Démarrer la séance immédiatement"
                variant="primary"
                size="lg"
                onPress={handleStartWorkout}
                style={{ marginBottom: 12 }}
              />

              <Button
                title="⭐ Enregistrer dans mes programmes"
                variant="outline"
                size="md"
                onPress={handleSaveProgram}
                loading={savingProgram}
                style={{ marginBottom: 12 }}
              />

              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={() => setGeneratedPlan(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.regenerateBtnText}>
                  🔄 Modifier les critères ou régénérer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Guide d'exécution technique */}
      <ExerciseGuideModal
        visible={guideModalVisible}
        exercise={selectedGuideExercise}
        onClose={() => setGuideModalVisible(false)}
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
    padding: 16,
    paddingBottom: 48,
  },
  headerBox: {
    marginBottom: 20,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    gap: 6,
  },
  aiPillEmoji: {
    fontSize: 14,
  },
  aiPillText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetCard: {
    width: '31%',
    backgroundColor: '#162032',
    borderWidth: 1.5,
    borderColor: '#243248',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  targetCardActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: Colors.primary,
  },
  targetEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  targetLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  targetLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  trainingTypeColumn: {
    gap: 8,
  },
  trainingCard: {
    backgroundColor: '#162032',
    borderWidth: 1.5,
    borderColor: '#243248',
    borderRadius: 14,
    padding: 12,
  },
  trainingCardActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: Colors.primary,
  },
  trainingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trainingEmoji: {
    fontSize: 26,
  },
  trainingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  trainingTitleActive: {
    color: '#93C5FD',
  },
  trainingDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  trainingBadgeBox: {
    backgroundColor: '#202E42',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trainingBadgeBoxActive: {
    backgroundColor: Colors.primary,
  },
  trainingBadgeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  trainingBadgeTextActive: {
    color: Colors.primaryText,
    fontWeight: '800',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  durationPill: {
    backgroundColor: '#162032',
    borderWidth: 1.5,
    borderColor: '#243248',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  durationText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  durationTextActive: {
    color: Colors.primaryText,
    fontWeight: '900',
  },
  equipHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipCountText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  equipChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  equipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2A',
    borderWidth: 1,
    borderColor: '#223046',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  equipChipChecked: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  equipChipEmoji: {
    fontSize: 13,
  },
  equipChipText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  equipChipTextChecked: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  equipChipCheck: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  planSummaryCard: {
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: '#141E2F',
  },
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  planSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },
  rationaleBox: {
    backgroundColor: '#0F1624',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    marginBottom: 14,
  },
  rationaleTitle: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  rationaleText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  protocolRow: {
    gap: 8,
  },
  protocolBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F1624',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  protocolIcon: {
    fontSize: 18,
  },
  protocolTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  protocolText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  actionsTopRow: {
    marginBottom: 14,
  },
  exerciseCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: '#141E2E',
    borderWidth: 1,
    borderColor: '#202E42',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  phaseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exerciseOrderText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  exerciseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoGuideBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoGuideIcon: {
    fontSize: 14,
  },
  favoriteCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteCardBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  favoriteCardBtnIcon: {
    fontSize: 15,
  },
  exerciseMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#0E1624',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1A2536',
  },
  metricVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  metricLbl: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  tempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  tempoLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tempoValue: {
    color: Colors.textSecondary,
    fontSize: 11,
    flex: 1,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  tipIcon: {
    fontSize: 14,
  },
  tipText: {
    color: '#BFDBFE',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  altBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  altLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  altText: {
    color: Colors.textSecondary,
    fontSize: 11,
    flex: 1,
  },
  bottomActions: {
    marginTop: 10,
  },
  regenerateBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  regenerateBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
