import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  BODY_ZONES,
  MUSCLE_GROUPS_INFO,
  BodyZoneId,
  filterExercisesByMuscleTarget,
} from '../../constants/muscles';
import { MuscleGroup, Exercise, Program } from '../../types';
import { getAllExercises } from '../../database/exerciseRepository';
import { getAllPrograms } from '../../database/programRepository';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isExerciseCompatibleWithEquipment,
  isProgramCompatibleByEquipmentString,
} from '../../utils/exerciseUnits';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import {
  getFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '../../services/favoritesService';
import { ExerciseGuideModal } from '../../components/workout/ExerciseGuideModal';
import { showAlert } from '../../utils/alert';

export default function TargetMuscleScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [selectedGuideExercise, setSelectedGuideExercise] = useState<Exercise | null>(null);

  // Sélections
  const [selectedZoneId, setSelectedZoneId] = useState<BodyZoneId>('upper');
  const [selectedMuscleGroup, setSelectedMuscleGroup] =
    useState<MuscleGroup>('Pectoraux');
  const [selectedPreciseMuscleId, setSelectedPreciseMuscleId] =
    useState<string>('all');

  const { isActive, programName, startWorkoutFromProgram, startTargetedWorkout, addExerciseToWorkout } =
    useWorkoutSessionStore();
  const { available_equipments, filter_by_available_equipment } =
    useSettingsStore();

  const isEquipmentFilterRestricting = useMemo(() => {
    return (
      Boolean(filter_by_available_equipment) &&
      (available_equipments || []).length < 13
    );
  }, [filter_by_available_equipment, available_equipments]);

  const loadData = useCallback(async () => {
    try {
      const [exList, progList, favs] = await Promise.all([
        getAllExercises(),
        getAllPrograms(),
        getFavoriteExerciseIds(),
      ]);
      setExercises(exList);
      setPrograms(progList);
      setFavoriteIds(favs);
    } catch (err) {
      console.error('Erreur chargement ciblage musculaire:', err);
    }
  }, []);

  const handleToggleFavorite = async (exerciseId: string) => {
    await toggleFavoriteExercise(exerciseId);
    const updated = await getFavoriteExerciseIds();
    setFavoriteIds(updated);
  };

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

  // Zone actuelle
  const currentZone = useMemo(
    () => BODY_ZONES.find((z) => z.id === selectedZoneId) || BODY_ZONES[0],
    [selectedZoneId]
  );

  // Groupes musculaires de la zone
  const availableGroups = currentZone.groups;

  // Détails du groupe musculaire actuel
  const currentGroupInfo = MUSCLE_GROUPS_INFO[selectedMuscleGroup];

  // Changement de zone anatomique
  const handleSelectZone = (zoneId: BodyZoneId) => {
    setSelectedZoneId(zoneId);
    const zone = BODY_ZONES.find((z) => z.id === zoneId);
    if (zone && zone.groups.length > 0) {
      setSelectedMuscleGroup(zone.groups[0]);
      setSelectedPreciseMuscleId('all');
    }
  };

  // Changement de groupe musculaire
  const handleSelectGroup = (group: MuscleGroup) => {
    setSelectedMuscleGroup(group);
    setSelectedPreciseMuscleId('all');
  };

  // Exercices filtrés selon la sélection précise et le matériel disponible
  const targetedExercises = useMemo(() => {
    const list = filterExercisesByMuscleTarget(
      exercises,
      selectedMuscleGroup,
      selectedPreciseMuscleId
    );
    if (!filter_by_available_equipment) return list;
    return list.filter((ex) =>
      isExerciseCompatibleWithEquipment(ex, available_equipments)
    );
  }, [
    exercises,
    selectedMuscleGroup,
    selectedPreciseMuscleId,
    filter_by_available_equipment,
    available_equipments,
  ]);

  // Programmes associés à ce groupe musculaire et compatibles avec le matériel
  const matchingPrograms = useMemo(() => {
    if (!currentGroupInfo) return [];
    const list = programs.filter((p) =>
      currentGroupInfo.programIds.includes(p.id)
    );
    if (!filter_by_available_equipment) return list;
    return list.filter((p) =>
      isProgramCompatibleByEquipmentString(p, available_equipments)
    );
  }, [
    programs,
    currentGroupInfo,
    filter_by_available_equipment,
    available_equipments,
  ]);

  // Nom du muscle sélectionné (pour le titre de la séance)
  const currentSelectionLabel = useMemo(() => {
    if (selectedPreciseMuscleId === 'all') {
      return selectedMuscleGroup;
    }
    const precise = currentGroupInfo?.preciseMuscles.find(
      (p) => p.id === selectedPreciseMuscleId
    );
    return precise ? precise.name : selectedMuscleGroup;
  }, [selectedMuscleGroup, selectedPreciseMuscleId, currentGroupInfo]);

  // Lancement express de la séance avec jusqu'à 4 exercices complémentaires (Séance Express ~30-40 min)
  const handleStartTargetedWorkout = async () => {
    if (targetedExercises.length === 0) return;
    if (isActive) {
      showAlert(
        'Séance déjà en cours ⚡',
        `La séance « ${programName || 'Séance libre'} » est en cours. Voulez-vous la remplacer par la séance ciblée « ${currentSelectionLabel} » ?`,
        [
          { text: 'Reprendre en cours', style: 'cancel', onPress: () => router.push('/workout/active') },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: async () => {
              await startTargetedWorkout(currentSelectionLabel, targetedExercises.slice(0, 4));
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await startTargetedWorkout(currentSelectionLabel, targetedExercises.slice(0, 4));
    router.push('/workout/active');
  };

  // Lancement d'un programme sélectionné
  const handleStartProgram = async (programId: string) => {
    if (isActive) {
      showAlert(
        'Séance déjà en cours ⚡',
        `La séance « ${programName || 'Séance libre'} » est en cours. Voulez-vous la remplacer par ce programme ?`,
        [
          { text: 'Reprendre en cours', style: 'cancel', onPress: () => router.push('/workout/active') },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: async () => {
              await startWorkoutFromProgram(programId);
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await startWorkoutFromProgram(programId);
    router.push('/workout/active');
  };

  // Lancement direct d'un exercice individuel
  const handleStartSingleExercise = async (exercise: Exercise) => {
    if (isActive) {
      showAlert(
        'Séance déjà en cours',
        `Une séance est actuellement active. Voulez-vous ajouter « ${exercise.name} » à votre séance en cours ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ajouter à la séance',
            onPress: () => {
              addExerciseToWorkout(exercise);
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await startTargetedWorkout(exercise.name, [exercise]);
    router.push('/workout/active');
  };

  return (
    <View style={styles.container}>
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
        {/* Titre et Explication */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎯 Ciblage Musculaire</Text>
          <Text style={styles.headerSubtitle}>
            Choisissez la zone du corps et le muscle exact à travailler pour révéler les exercices et programmes ciblés.
          </Text>
        </View>

        {/* 1. ÉTAPE 1 : CHOIX DE LA ZONE ANATOMIQUE */}
        <View style={styles.sectionBlock}>
          <Text style={styles.stepTitle}>1. Zone du Corps</Text>
          <View style={styles.zoneGrid}>
            {BODY_ZONES.map((zone) => {
              const isSelected = zone.id === selectedZoneId;
              const isFullSpan = zone.id === 'full';
              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[
                    styles.zoneCard,
                    isFullSpan && styles.zoneCardFullSpan,
                    isSelected && {
                      borderColor: zone.color,
                      backgroundColor: '#162234',
                    },
                  ]}
                  onPress={() => handleSelectZone(zone.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.zoneCardTop}>
                    <Text style={styles.zoneEmoji}>{zone.emoji}</Text>
                    {isSelected && (
                      <View
                        style={[styles.activeDot, { backgroundColor: zone.color }]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.zoneName,
                      isSelected && { color: '#FFFFFF', fontWeight: '900' },
                    ]}
                  >
                    {zone.name}
                  </Text>
                  <Text style={styles.zoneSubtitle} numberOfLines={1}>
                    {zone.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. ÉTAPE 2 : CHOIX DU GROUPE MUSCULAIRE */}
        <View style={styles.sectionBlock}>
          <Text style={styles.stepTitle}>2. Groupe Musculaire</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupPillsRow}
          >
            {availableGroups.map((group) => {
              const isSelected = group === selectedMuscleGroup;
              const info = MUSCLE_GROUPS_INFO[group];
              const color = info?.color || Colors.primary;

              return (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.groupPill,
                    isSelected && {
                      borderColor: color,
                      backgroundColor: `${color}25`,
                    },
                  ]}
                  onPress={() => handleSelectGroup(group)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.groupPillEmoji}>{info?.emoji || '💪'}</Text>
                  <Text
                    style={[
                      styles.groupPillText,
                      isSelected && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
                    {group}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. ÉTAPE 3 : CHOIX DU MUSCLE PRÉCIS / ANATOMIE */}
        {currentGroupInfo && currentGroupInfo.preciseMuscles.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.preciseHeader}>
              <Text style={styles.stepTitle}>3. Ciblage Anatomique Précis</Text>
              <Text style={styles.preciseCountText}>
                {targetedExercises.length} exercice{targetedExercises.length > 1 ? 's' : ''}
              </Text>
            </View>

            {/* Sélecteur Tous vs Sous-muscles */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.preciseChipsRow}
            >
              <TouchableOpacity
                style={[
                  styles.preciseChip,
                  selectedPreciseMuscleId === 'all' && styles.preciseChipActive,
                ]}
                onPress={() => setSelectedPreciseMuscleId('all')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.preciseChipText,
                    selectedPreciseMuscleId === 'all' && styles.preciseChipTextActive,
                  ]}
                >
                  🌐 Tous ({selectedMuscleGroup})
                </Text>
              </TouchableOpacity>

              {currentGroupInfo.preciseMuscles.map((sub) => {
                const isSelected = selectedPreciseMuscleId === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.preciseChip,
                      isSelected && styles.preciseChipActive,
                    ]}
                    onPress={() => setSelectedPreciseMuscleId(sub.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.preciseChipText,
                        isSelected && styles.preciseChipTextActive,
                      ]}
                    >
                      {sub.emoji} {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Note anatomique explicative */}
            {selectedPreciseMuscleId !== 'all' && (
              <View style={styles.anatomyNoteCard}>
                <Text style={styles.anatomyNoteIcon}>💡</Text>
                <Text style={styles.anatomyNoteText}>
                  {
                    currentGroupInfo.preciseMuscles.find(
                      (p) => p.id === selectedPreciseMuscleId
                    )?.anatomicalFocus
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bandeau d'information si le filtrage matériel est actif */}
        {isEquipmentFilterRestricting && (
          <TouchableOpacity
            style={styles.equipmentFilterBanner}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.equipmentFilterBannerLeft}>
              <Text style={styles.equipmentFilterBannerIcon}>🎛️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.equipmentFilterBannerTitle}>
                  Filtrage matériel actif ({available_equipments?.length ?? 0}/13 équipements)
                </Text>
                <Text style={styles.equipmentFilterBannerSubtitle}>
                  {targetedExercises.length} exercice{targetedExercises.length > 1 ? 's' : ''} et {matchingPrograms.length} programme{matchingPrograms.length > 1 ? 's' : ''} réalisable{targetedExercises.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.equipmentFilterBannerAction}>Régler ⚙️</Text>
          </TouchableOpacity>
        )}

        {/* ⚡ BOUTON EXPRESS : DÉMARRER LA SÉANCE CIBLÉE EN 1 CLIC */}
        {targetedExercises.length > 0 && (
          <TouchableOpacity
            style={styles.expressStartBanner}
            onPress={handleStartTargetedWorkout}
            activeOpacity={0.85}
          >
            <View style={styles.expressBannerContent}>
              <View style={styles.expressIconBox}>
                <Text style={styles.expressIcon}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expressTitle}>
                  Séance Express : {currentSelectionLabel}
                </Text>
                <Text style={styles.expressSubtitle}>
                  Démarrer avec {Math.min(4, targetedExercises.length)} exercice{Math.min(4, targetedExercises.length) > 1 ? 's' : ''} clé{Math.min(4, targetedExercises.length) > 1 ? 's' : ''} (~30 min)
                </Text>
              </View>
              <Text style={styles.expressArrow}>▶</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 4. PROGRAMMES RECOMMANDÉS POUR CE GROUPE */}
        {matchingPrograms.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>
              🏋️ Programmes ciblant ce muscle ({matchingPrograms.length})
            </Text>

            {matchingPrograms.map((prog) => {
              const isRack900 = prog.name.includes('Rack 900');

              return (
                <Card
                  key={prog.id}
                  style={[styles.programCard, isRack900 && styles.rackHighlight]}
                  onPress={() => router.push(`/programs/${prog.id}`)}
                >
                  <View style={styles.programCardHeader}>
                    <Text style={styles.programName}>{prog.name}</Text>
                    <Badge
                      label={prog.difficulty_level}
                      color="rgba(255, 90, 31, 0.15)"
                      textColor={Colors.primary}
                    />
                  </View>
                  <Text style={styles.programDesc} numberOfLines={2}>
                    {prog.description}
                  </Text>
                  <View style={styles.programBottomRow}>
                    <TouchableOpacity
                      onPress={() => router.push(`/programs/${prog.id}`)}
                      style={styles.viewDetailBtn}
                    >
                      <Text style={styles.viewDetailText}>Voir le détail ❯</Text>
                    </TouchableOpacity>
                    <Button
                      title="Démarrer ▶"
                      size="sm"
                      variant="primary"
                      onPress={() => handleStartProgram(prog.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* 5. EXERCICES CIBLÉS AVEC ILLUSTRATION */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>
            💪 Exercices ciblés ({targetedExercises.length})
          </Text>

          {targetedExercises.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Aucun exercice trouvé</Text>
              <Text style={styles.emptySub}>
                {isEquipmentFilterRestricting
                  ? 'Aucun exercice pour ce muscle avec votre matériel actuellement sélectionné.'
                  : 'Essayez de sélectionner un autre groupe ou un ciblage plus large.'}
              </Text>
              {isEquipmentFilterRestricting && (
                <Button
                  title="⚙️ Modifier les équipements"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/(tabs)/settings')}
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>
          ) : (
            targetedExercises.map((exercise) => (
              <Card key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseCardRow}>
                  {/* Illustration vectorielle */}
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedGuideExercise(exercise);
                      setGuideModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <ExerciseIllustration
                      targetMuscle={exercise.target_muscle}
                      exerciseId={exercise.id}
                      size={64}
                    />
                  </TouchableOpacity>

                  {/* Infos exercice */}
                  <TouchableOpacity
                    style={styles.exerciseInfo}
                    onPress={() => {
                      setSelectedGuideExercise(exercise);
                      setGuideModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={styles.badgesRow}>
                      <Badge
                        label={exercise.target_muscle}
                        color="rgba(59, 130, 246, 0.2)"
                        textColor="#60A5FA"
                      />
                      <Badge
                        label={exercise.equipment_needed}
                        color="rgba(16, 185, 129, 0.2)"
                        textColor="#34D399"
                      />
                    </View>
                    <Text style={styles.exerciseDesc} numberOfLines={2}>
                      {exercise.description}
                    </Text>
                  </TouchableOpacity>

                  {/* Actions droite : Lancer, Guide & Favori */}
                  <View style={styles.exerciseActionBtns}>
                    <TouchableOpacity
                      onPress={() => handleStartSingleExercise(exercise)}
                      style={styles.startExerciseCardBtn}
                      activeOpacity={0.8}
                      accessibilityLabel={`Démarrer ${exercise.name}`}
                    >
                      <Text style={styles.startExerciseCardBtnText}>Lancer ▶</Text>
                    </TouchableOpacity>

                    <View style={styles.miniIconsRow}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedGuideExercise(exercise);
                          setGuideModalVisible(true);
                        }}
                        style={styles.guideCardBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.guideCardBtnIcon}>ℹ️</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleToggleFavorite(exercise.id)}
                        style={[
                          styles.favoriteCardBtn,
                          favoriteIds.includes(exercise.id) && styles.favoriteCardBtnActive,
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.favoriteCardBtnIcon}>
                          {favoriteIds.includes(exercise.id) ? '⭐' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  zoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  zoneCard: {
    width: '48%',
    backgroundColor: '#121A28',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#1D2A3E',
  },
  zoneCardFullSpan: {
    width: '100%',
  },
  zoneCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  zoneEmoji: {
    fontSize: 22,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneName: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  zoneSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  groupPillsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131D2D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#202E42',
  },
  groupPillEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  groupPillText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  preciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preciseCountText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  preciseChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  preciseChip: {
    backgroundColor: '#141E2F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2E44',
  },
  preciseChipActive: {
    backgroundColor: '#1E2D44',
    borderColor: Colors.accent,
  },
  preciseChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  preciseChipTextActive: {
    color: Colors.accent,
  },
  anatomyNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1826',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#192639',
  },
  anatomyNoteIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  anatomyNoteText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  expressStartBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  expressBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expressIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expressIcon: {
    fontSize: 22,
  },
  expressTitle: {
    color: Colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  expressSubtitle: {
    color: 'rgba(8, 12, 20, 0.85)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  expressArrow: {
    color: Colors.primaryText,
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 8,
  },
  programCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
  },
  rackHighlight: {
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  programCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  programName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  programDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  programBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#172233',
    paddingTop: 10,
  },
  viewDetailBtn: {
    paddingVertical: 4,
  },
  viewDetailText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseCard: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
  },
  exerciseCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  exerciseDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  exerciseActionBtns: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 8,
  },
  startExerciseCardBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startExerciseCardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  miniIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guideCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideCardBtnIcon: {
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
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  equipmentFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  equipmentFilterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  equipmentFilterBannerIcon: {
    fontSize: 20,
  },
  equipmentFilterBannerTitle: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  equipmentFilterBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  equipmentFilterBannerAction: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
});
