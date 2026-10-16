import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getAllExercises } from '../../database/exerciseRepository';
import { Exercise } from '../../types';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ExerciseSetRow } from '../../components/workout/ExerciseSetRow';
import { RestTimerBar } from '../../components/workout/RestTimerBar';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import {
  getExerciseUnitInfo,
  isExerciseCompatibleWithEquipment,
} from '../../utils/exerciseUnits';
import {
  getFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '../../services/favoritesService';
import { ExerciseGuideModal } from '../../components/workout/ExerciseGuideModal';

export default function ActiveWorkoutScreen() {
  const {
    isActive,
    programName,
    elapsedSeconds,
    notes,
    exercises,
    tickWorkoutTimer,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    addSetToExercise,
    removeSetFromExercise,
    updateSetValues,
    toggleSetCompleted,
    setNotes,
    finishWorkout,
    cancelWorkout,
  } = useWorkoutSessionStore();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [catalogExercises, setCatalogExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [modalFavoritesOnly, setModalFavoritesOnly] = useState(false);
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [selectedGuideExercise, setSelectedGuideExercise] = useState<Exercise | null>(null);
  const { available_equipments, filter_by_available_equipment } = useSettingsStore();

  // Chronomètre global de la séance
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      tickWorkoutTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, tickWorkoutTimer]);

  useEffect(() => {
    async function loadCatalog() {
      const list = await getAllExercises();
      setCatalogExercises(list);
    }
    async function loadFavorites() {
      const favs = await getFavoriteExerciseIds();
      setFavoriteIds(favs);
    }
    loadCatalog();
    loadFavorites();
  }, []);

  const handleToggleFavorite = async (exerciseId: string) => {
    await toggleFavoriteExercise(exerciseId);
    const updated = await getFavoriteExerciseIds();
    setFavoriteIds(updated);
  };

  const handleChallengeFromExercise = (exItem: { exercise: Exercise; sets: any[] }) => {
    const completedSets = exItem.sets.filter((s) => s.completed);
    let bestWeight = 0;
    let bestReps = 10;

    if (completedSets.length > 0) {
      const topSet = completedSets.reduce((prev, curr) =>
        (curr.weight || 0) > (prev.weight || 0) ? curr : prev
      );
      bestWeight = topSet.weight || 0;
      bestReps = topSet.reps || 10;
    } else if (exItem.sets.length > 0) {
      bestWeight = exItem.sets[0].weight || 0;
      bestReps = exItem.sets[0].reps || 10;
    }

    router.push({
      pathname: '/arena',
      params: {
        openChallenge: '1',
        challengeType: 'exercise',
        exerciseId: exItem.exercise.id,
        targetWeight: bestWeight > 0 ? String(bestWeight) : undefined,
        targetReps: String(bestReps),
      },
    });
  };

  const liveXp = useMemo(() => {
    let completedSets = 0;
    let volume = 0;
    exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.completed) {
          completedSets += 1;
          volume += (s.weight || 0) * (s.reps || 0);
        }
      });
    });
    const setsXp = completedSets * 15;
    const volumeXp = Math.floor(volume / 40);
    const completionBonus = completedSets > 0 ? 100 : 0;
    return {
      completedSets,
      volume,
      inProgressXp: setsXp + volumeXp,
      totalXp: setsXp + volumeXp + completionBonus,
    };
  }, [exercises]);

  if (!isActive) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Aucune séance active</Text>
        <Button
          title="Retour aux programmes"
          onPress={() => router.replace('/(tabs)')}
          variant="primary"
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinish = async () => {
    const totalCompleted = exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );

    if (totalCompleted === 0) {
      Alert.alert(
        'Aucune série validée',
        'Vous n’avez validé aucune série dans cette séance. Voulez-vous tout de même l’enregistrer ?',
        [
          { text: 'Continuer l’entraînement', style: 'cancel' },
          {
            text: 'Enregistrer quand même',
            onPress: async () => {
              const res = await finishWorkout();
              if (res) router.replace('/workout/summary');
            },
          },
        ]
      );
      return;
    }

    const res = await finishWorkout();
    if (res) {
      router.replace('/workout/summary');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Abandonner la séance',
      'Voulez-vous vraiment annuler cette séance ? Vos séries non enregistrées seront perdues.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleAddExerciseFromCatalog = async (exercise: Exercise) => {
    await addExerciseToWorkout(exercise);
    setAddModalVisible(false);
    setSearchQuery('');
  };

  const filteredCatalog = catalogExercises.filter((e) => {
    if (modalFavoritesOnly && !favoriteIds.includes(e.id)) {
      return false;
    }
    const matchesQuery =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.target_muscle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.equipment_needed.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (filter_by_available_equipment && available_equipments) {
      return isExerciseCompatibleWithEquipment(e, available_equipments);
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Barre supérieure fixe de l'entraînement */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerActionBtn}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.programTitle} numberOfLines={1}>
            {programName || 'Séance libre'}
          </Text>
          <View style={styles.timerBadgeRow}>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>⏱ {formatElapsed(elapsedSeconds)}</Text>
            </View>
            <View style={styles.xpLiveBadge}>
              <Text style={styles.xpLiveText}>⚡ +{liveXp.inProgressXp} XP</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleFinish} style={styles.finishBtn}>
          <Text style={styles.finishBtnText}>Terminer ✓</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Champ de notes optionnel */}
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            placeholder="Ajouter une note ou sensation (ex: banc libre, forme 8/10)..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Liste des exercices de la séance */}
        {exercises.length === 0 ? (
          <Card style={styles.emptyExercisesCard}>
            <Text style={styles.emptyIcon}>⚡</Text>
            <Text style={styles.emptyTitle}>Votre séance est vide</Text>
            <Text style={styles.emptyDesc}>
              Ajoutez des exercices depuis le catalogue pour débuter votre entraînement.
            </Text>
            <Button
              title="Ajouter un exercice"
              variant="primary"
              onPress={() => setAddModalVisible(true)}
              style={{ marginTop: 14 }}
            />
          </Card>
        ) : (
          exercises.map((exItem, exIdx) => (
            <Card key={`${exItem.exercise.id}_${exIdx}`} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedGuideExercise(exItem.exercise);
                    setGuideModalVisible(true);
                  }}
                  activeOpacity={0.75}
                >
                  <ExerciseIllustration
                    exerciseId={exItem.exercise.id}
                    targetMuscle={exItem.exercise.target_muscle}
                    size={46}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedGuideExercise(exItem.exercise);
                      setGuideModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.exerciseName}>{exItem.exercise.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.metaRow}>
                    <Badge
                      label={exItem.exercise.target_muscle}
                      color="#202F44"
                      textColor={Colors.textSecondary}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedGuideExercise(exItem.exercise);
                        setGuideModalVisible(true);
                      }}
                      style={styles.guideBadge}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.guideBadgeText}>ℹ️ Guide posture</Text>
                    </TouchableOpacity>
                    <Text style={styles.restInfoText}>
                      Repos : {exItem.rest_time_seconds}s
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRightActions}>
                  {/* Bulle d'info / Guide technique */}
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedGuideExercise(exItem.exercise);
                      setGuideModalVisible(true);
                    }}
                    style={styles.infoGuideBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.infoGuideIcon}>ℹ️</Text>
                  </TouchableOpacity>

                  {/* Bouton favori */}
                  <TouchableOpacity
                    onPress={() => handleToggleFavorite(exItem.exercise.id)}
                    style={[
                      styles.favHeaderBtn,
                      favoriteIds.includes(exItem.exercise.id) && styles.favHeaderBtnActive,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.favHeaderIcon}>
                      {favoriteIds.includes(exItem.exercise.id) ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>

                  {/* Bouton Défier en 1 clic */}
                  <TouchableOpacity
                    onPress={() => handleChallengeFromExercise(exItem)}
                    style={styles.challengeHeaderBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.challengeHeaderIcon}>⚔️</Text>
                  </TouchableOpacity>

                  {/* Bouton supprimer de la séance */}
                  <TouchableOpacity
                    onPress={() => removeExerciseFromWorkout(exIdx)}
                    style={styles.removeExBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeExText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Titres de colonnes adaptés à l'exercice (minutes en vélo, tapis, rameur) */}
              {(() => {
                const unitInfo = getExerciseUnitInfo(exItem.exercise);
                return (
                  <View style={styles.columnHeaders}>
                    <Text style={[styles.colHeader, { width: 48, textAlign: 'center' }]}>
                      SÉRIE
                    </Text>
                    <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                      {unitInfo.loadLabel}
                    </Text>
                    <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                      {unitInfo.valueLabel}
                    </Text>
                    <Text style={[styles.colHeader, { width: 48, textAlign: 'center' }]}>
                      FAIT
                    </Text>
                    <View style={{ width: 28 }} />
                  </View>
                );
              })()}

              {/* Lignes de séries */}
              {exItem.sets.map((set, setIdx) => (
                <ExerciseSetRow
                  key={set.id}
                  set={set}
                  exercise={exItem.exercise}
                  exerciseIndex={exIdx}
                  setIndex={setIdx}
                  onUpdate={(w, r) => updateSetValues(exIdx, setIdx, w, r)}
                  onToggleComplete={() => toggleSetCompleted(exIdx, setIdx)}
                  onRemove={() => removeSetFromExercise(exIdx, setIdx)}
                />
              ))}

              {/* Bouton ajouter une série */}
              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addSetToExercise(exIdx)}
                activeOpacity={0.7}
              >
                <Text style={styles.addSetBtnText}>+ Ajouter une série</Text>
              </TouchableOpacity>

              {/* Bannière de validation quand toutes les séries de l'exercice sont faites */}
              {(() => {
                const isCompleted = exItem.sets.length > 0 && exItem.sets.every((s) => s.completed);
                const exCompletedSets = exItem.sets.filter((s) => s.completed).length;
                const exVol = exItem.sets.filter((s) => s.completed).reduce((acc, s) => acc + s.weight * s.reps, 0);
                const exXp = exCompletedSets * 15 + Math.floor(exVol / 40);

                if (!isCompleted) return null;

                return (
                  <View style={styles.exerciseCompletedBanner}>
                    <Text style={styles.exerciseCompletedEmoji}>🎉</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseCompletedTitle}>Exercice validé !</Text>
                      <Text style={styles.exerciseCompletedSub}>
                        {exCompletedSets} séries terminées • +{exXp} XP gagnés
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.finishExerciseQuickBtn}
                      onPress={handleFinish}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.finishExerciseQuickText}>Terminer ✓</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </Card>
          ))
        )}

        {/* Bouton pour ajouter un autre exercice à la séance */}
        {exercises.length > 0 && (
          <Button
            title="+ Ajouter un exercice à la séance"
            variant="outline"
            size="lg"
            onPress={() => setAddModalVisible(true)}
            style={styles.addAnotherExerciseBtn}
          />
        )}

        {/* Bouton direct pour valider et terminer la séance avec ses gains XP */}
        {exercises.length > 0 && (
          <TouchableOpacity
            style={styles.bottomFinishBigBtn}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.bottomFinishBigEmoji}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomFinishBigTitle}>Valider et terminer la séance</Text>
              <Text style={styles.bottomFinishBigSub}>
                {liveXp.completedSets} séries validées • +{liveXp.totalXp} XP à cumuler
              </Text>
            </View>
            <Text style={styles.bottomFinishBigArrow}>▶</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Barre de chronomètre de repos flottante */}
      <RestTimerBar />

      {/* Modal de sélection d'exercice depuis le catalogue */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ajouter un exercice</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom ou muscle..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* Filtres Tous / Favoris dans la modal */}
          <View style={styles.modalFilterRow}>
            <TouchableOpacity
              style={[
                styles.modalFilterChip,
                !modalFavoritesOnly && styles.modalFilterChipActive,
              ]}
              onPress={() => setModalFavoritesOnly(false)}
            >
              <Text
                style={[
                  styles.modalFilterChipText,
                  !modalFavoritesOnly && styles.modalFilterChipTextActive,
                ]}
              >
                Tous ({catalogExercises.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalFilterChip,
                modalFavoritesOnly && styles.modalFilterChipActive,
              ]}
              onPress={() => setModalFavoritesOnly(true)}
            >
              <Text
                style={[
                  styles.modalFilterChipText,
                  modalFavoritesOnly && styles.modalFilterChipTextActive,
                ]}
              >
                ⭐ Favoris ({favoriteIds.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.catalogList}>
            {filteredCatalog.length === 0 ? (
              <View style={styles.emptyFilterBox}>
                <Text style={styles.emptyFilterEmoji}>⭐</Text>
                <Text style={styles.emptyFilterText}>
                  {modalFavoritesOnly
                    ? 'Aucun exercice favori pour le moment. Cliquez sur l’étoile pour en ajouter !'
                    : 'Aucun exercice trouvé.'}
                </Text>
              </View>
            ) : (
              filteredCatalog.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  style={styles.catalogItem}
                  onPress={() => handleAddExerciseFromCatalog(ex)}
                  activeOpacity={0.75}
                >
                  <ExerciseIllustration
                    exerciseId={ex.id}
                    targetMuscle={ex.target_muscle}
                    size={42}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.catalogItemName}>{ex.name}</Text>
                    <Text style={styles.catalogItemMeta}>
                      {ex.target_muscle} • {ex.equipment_needed}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedGuideExercise(ex);
                      setGuideModalVisible(true);
                    }}
                    style={styles.catalogInfoBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.catalogInfoIcon}>ℹ️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(ex.id);
                    }}
                    style={[
                      styles.catalogFavBtn,
                      favoriteIds.includes(ex.id) && styles.catalogFavBtnActive,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.catalogFavIcon}>
                      {favoriteIds.includes(ex.id) ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.catalogAddIcon}>+</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modale d'aide et guide technique de l'exercice (Posture, Amplitude, Position, Objectif, Sécurité) */}
      <ExerciseGuideModal
        visible={guideModalVisible}
        exercise={selectedGuideExercise}
        onClose={() => setGuideModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: '#0D1321',
  },
  headerActionBtn: {
    padding: 6,
  },
  cancelText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  programTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  timerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  timerBadge: {
    backgroundColor: 'rgba(255, 85, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timerText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  xpLiveBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  xpLiveText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  finishBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110, // espace pour la barre de repos
  },
  notesContainer: {
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: '#121A28',
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  emptyExercisesCard: {
    alignItems: 'center',
    padding: 30,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  exerciseCard: {
    marginBottom: 16,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restInfoText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoGuideBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoGuideIcon: {
    fontSize: 16,
  },
  guideBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  guideBadgeText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  favHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favHeaderBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  favHeaderIcon: {
    fontSize: 18,
  },
  challengeHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeHeaderIcon: {
    fontSize: 16,
  },
  removeExBtn: {
    padding: 4,
  },
  removeExText: {
    color: Colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  colHeader: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addSetBtn: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#162235',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  addSetBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  addAnotherExerciseBtn: {
    marginVertical: 12,
  },
  exerciseCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    gap: 8,
  },
  exerciseCompletedEmoji: {
    fontSize: 20,
  },
  exerciseCompletedTitle: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '900',
  },
  exerciseCompletedSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  finishExerciseQuickBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  finishExerciseQuickText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  bottomFinishBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    gap: 12,
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  bottomFinishBigEmoji: {
    fontSize: 28,
  },
  bottomFinishBigTitle: {
    color: Colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  bottomFinishBigSub: {
    color: 'rgba(8, 12, 20, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomFinishBigArrow: {
    color: Colors.primaryText,
    fontSize: 18,
    fontWeight: '900',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  searchBox: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#162235',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  catalogList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  catalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121A28',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  catalogItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  catalogItemMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  catalogAddIcon: {
    fontSize: 22,
    color: Colors.primary,
    fontWeight: '800',
    marginLeft: 12,
  },
  modalFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  modalFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
  },
  modalFilterChipActive: {
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    borderColor: Colors.primary,
  },
  modalFilterChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalFilterChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  emptyFilterBox: {
    alignItems: 'center',
    padding: 30,
    marginTop: 20,
  },
  emptyFilterEmoji: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyFilterText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  catalogInfoBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  catalogInfoIcon: {
    fontSize: 14,
  },
  catalogFavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#182436',
    borderWidth: 1,
    borderColor: '#263750',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  catalogFavBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  catalogFavIcon: {
    fontSize: 15,
  },
});
