import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllExercises } from '../../database/exerciseRepository';
import { createCustomProgram } from '../../database/programRepository';
import { Exercise, DifficultyLevel } from '../../types';
import { DIFFICULTY_LEVELS, MUSCLE_GROUPS } from '../../constants/muscles';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import { getFavoriteExerciseIds } from '../../services/favoritesService';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isDurationExercise,
  getExerciseUnitInfo,
  isExerciseCompatibleWithEquipment,
} from '../../utils/exerciseUnits';
import { showAlert } from '../../utils/alert';

interface SelectedExerciseConfig {
  exercise: Exercise;
  default_sets: number;
  default_reps: number;
  rest_time_seconds: number;
}

export default function CreateProgramScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Intermédiaire');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExerciseConfig[]>([]);

  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('Tous');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const { available_equipments, filter_by_available_equipment } = useSettingsStore();

  const filteredModalExercises = useMemo(() => {
    return allExercises.filter((ex) => {
      // 1. Filtre par équipement disponible
      if (filter_by_available_equipment && !isExerciseCompatibleWithEquipment(ex, available_equipments)) {
        return false;
      }
      // 2. Filtre favoris
      if (showFavoritesOnly && !favoriteIds.includes(ex.id)) {
        return false;
      }
      // 3. Filtre par groupe musculaire
      if (selectedMuscle !== 'Tous' && ex.target_muscle !== selectedMuscle) {
        return false;
      }
      // 4. Recherche textuelle (nom, muscle ou équipement)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = ex.name.toLowerCase().includes(q);
        const matchMuscle = ex.target_muscle.toLowerCase().includes(q);
        const matchEq = ex.equipment_needed.toLowerCase().includes(q);
        if (!matchName && !matchMuscle && !matchEq) return false;
      }
      return true;
    });
  }, [allExercises, filter_by_available_equipment, available_equipments, showFavoritesOnly, favoriteIds, selectedMuscle, searchQuery]);

  useEffect(() => {
    async function load() {
      const [list, favs] = await Promise.all([
        getAllExercises(),
        getFavoriteExerciseIds(),
      ]);
      setAllExercises(list);
      setFavoriteIds(favs);
    }
    load();
  }, []);

  const handleAddExercise = (exercise: Exercise) => {
    // Éviter les doublons
    if (selectedExercises.some((item) => item.exercise.id === exercise.id)) {
      showAlert('Exercice déjà ajouté', 'Cet exercice est déjà dans la liste.');
      return;
    }

    const isDuration = isDurationExercise(exercise);
    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise,
        default_sets: isDuration ? 1 : 3,
        default_reps: isDuration ? 15 : 10,
        rest_time_seconds: isDuration ? 60 : 90,
      },
    ]);
    setCatalogModalVisible(false);
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateConfig = (
    index: number,
    field: 'default_sets' | 'default_reps' | 'rest_time_seconds',
    delta: number
  ) => {
    setSelectedExercises((prev) => {
      const updated = [...prev];
      const current = updated[index][field];
      const minVal = field === 'rest_time_seconds' ? 15 : 1;
      updated[index][field] = Math.max(minVal, current + delta);
      return updated;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Nom requis', 'Veuillez saisir un nom pour votre programme.');
      return;
    }

    if (selectedExercises.length === 0) {
      showAlert(
        'Aucun exercice',
        'Veuillez ajouter au moins un exercice à votre programme.'
      );
      return;
    }

    setSaving(true);
    try {
      await createCustomProgram({
        name: name.trim(),
        description: description.trim(),
        difficulty_level: difficulty,
        exercises: selectedExercises.map((se) => ({
          exercise_id: se.exercise.id,
          default_sets: se.default_sets,
          default_reps: se.default_reps,
          rest_time_seconds: se.rest_time_seconds,
        })),
      });

      showAlert('Succès', 'Votre programme a été créé avec succès !', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      showAlert('Erreur', err.message || 'Impossible d’enregistrer le programme.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Input
          label="Nom du programme"
          placeholder="Ex: Pecs & Épaules Explosif"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Description / Objectif"
          placeholder="Ex: Séance de force ciblée sur le haut du corps"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Niveau de difficulté */}
        <Text style={styles.label}>Niveau de difficulté</Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTY_LEVELS.map((level) => {
            const isSelected = difficulty === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.diffBtn, isSelected && styles.diffBtnActive]}
                onPress={() => setDifficulty(level)}
                activeOpacity={0.7}
              >
                <Text style={[styles.diffBtnText, isSelected && styles.diffBtnTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section Exercices sélectionnés */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Exercices ({selectedExercises.length})
          </Text>
          <TouchableOpacity
            onPress={() => setCatalogModalVisible(true)}
            style={styles.addExerciseLink}
          >
            <Text style={styles.addExerciseLinkText}>+ Ajouter un exercice</Text>
          </TouchableOpacity>
        </View>

        {selectedExercises.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Aucun exercice sélectionné. Touchez le bouton ci-dessous pour piocher dans le
              catalogue.
            </Text>
            <Button
              title="+ Choisir dans le catalogue"
              variant="outline"
              size="sm"
              onPress={() => setCatalogModalVisible(true)}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          selectedExercises.map((item, idx) => {
            const unitInfo = getExerciseUnitInfo(item.exercise);
            return (
              <Card key={`${item.exercise.id}_${idx}`} style={styles.exerciseCard}>
                <View style={styles.exerciseTopRow}>
                  <ExerciseIllustration
                    exerciseId={item.exercise.id}
                    targetMuscle={item.exercise.target_muscle}
                    size={46}
                  />
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                    <Badge
                      label={item.exercise.target_muscle}
                      color="#213045"
                      textColor={Colors.textSecondary}
                      style={{ marginTop: 4, alignSelf: 'flex-start' }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(idx)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Ajusteurs de séries, reps et temps de repos */}
                <View style={styles.adjustersRow}>
                  <View style={styles.adjusterBox}>
                    <Text style={styles.adjusterLabel}>Séries</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'default_sets', -1)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{item.default_sets}</Text>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'default_sets', 1)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.adjusterBox}>
                    <Text style={styles.adjusterLabel}>
                      {unitInfo.isDuration ? 'Durée' : 'Répétitions'}
                    </Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'default_reps', -1)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>
                        {item.default_reps} {unitInfo.valueUnit}
                      </Text>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'default_reps', 1)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.adjusterBox}>
                    <Text style={styles.adjusterLabel}>Repos</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'rest_time_seconds', -15)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{item.rest_time_seconds}s</Text>
                      <TouchableOpacity
                        onPress={() => updateConfig(idx, 'rest_time_seconds', 15)}
                        style={styles.stepBtn}
                      >
                        <Text style={styles.stepText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        <Button
          title="Enregistrer le programme"
          variant="primary"
          size="lg"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: 24 }}
        />
      </ScrollView>

      {/* Modal Catalogue d'exercices */}
      <Modal
        visible={catalogModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCatalogModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Sélectionner un exercice</Text>
              <Text style={styles.modalSubtitle}>
                {filteredModalExercises.length} exercice{filteredModalExercises.length > 1 ? 's' : ''} disponible{filteredModalExercises.length > 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setCatalogModalVisible(false)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          {/* 1. BARRE DE RECHERCHE */}
          <View style={styles.modalSearchBox}>
            <Text style={styles.modalSearchIcon}>🔍</Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Rechercher par nom, muscle, équipement..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 2. CHIPS DE FILTRAGE (TOUS, FAVORIS, MUSCLES) */}
          <View style={styles.chipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              <TouchableOpacity
                style={[
                  styles.modalFilterChip,
                  selectedMuscle === 'Tous' && !showFavoritesOnly && styles.modalFilterChipActive,
                ]}
                onPress={() => {
                  setSelectedMuscle('Tous');
                  setShowFavoritesOnly(false);
                }}
              >
                <Text
                  style={[
                    styles.modalFilterChipText,
                    selectedMuscle === 'Tous' && !showFavoritesOnly && styles.modalFilterChipTextActive,
                  ]}
                >
                  Tous ({allExercises.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalFilterChip,
                  styles.modalFilterChipFavorite,
                  showFavoritesOnly && styles.modalFilterChipFavoriteActive,
                ]}
                onPress={() => {
                  setShowFavoritesOnly(!showFavoritesOnly);
                  if (!showFavoritesOnly) setSelectedMuscle('Tous');
                }}
              >
                <Text
                  style={[
                    styles.modalFilterChipText,
                    styles.modalFilterChipFavoriteText,
                    showFavoritesOnly && styles.modalFilterChipFavoriteTextActive,
                  ]}
                >
                  ⭐ Favoris ({favoriteIds.length})
                </Text>
              </TouchableOpacity>

              {MUSCLE_GROUPS.map((muscle) => {
                const isSelected = selectedMuscle === muscle && !showFavoritesOnly;
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={[styles.modalFilterChip, isSelected && styles.modalFilterChipActive]}
                    onPress={() => {
                      setSelectedMuscle(muscle);
                      setShowFavoritesOnly(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalFilterChipText,
                        isSelected && styles.modalFilterChipTextActive,
                      ]}
                    >
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 3. LISTE DES EXERCICES ILLUSTRÉS */}
          <ScrollView contentContainerStyle={styles.modalList} keyboardShouldPersistTaps="handled">
            {filteredModalExercises.length === 0 ? (
              <View style={styles.modalEmptyBox}>
                <Text style={styles.modalEmptyIcon}>🔍</Text>
                <Text style={styles.modalEmptyTitle}>Aucun exercice trouvé</Text>
                <Text style={styles.modalEmptySub}>
                  Essayez d’ajuster votre recherche ou sélectionnez un autre groupe musculaire.
                </Text>
              </View>
            ) : (
              filteredModalExercises.map((ex) => {
                const isAlreadyAdded = selectedExercises.some((item) => item.exercise.id === ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.modalItem, isAlreadyAdded && styles.modalItemDisabled]}
                    onPress={() => handleAddExercise(ex)}
                    activeOpacity={isAlreadyAdded ? 1 : 0.7}
                    disabled={isAlreadyAdded}
                  >
                    <ExerciseIllustration
                      exerciseId={ex.id}
                      targetMuscle={ex.target_muscle}
                      size={52}
                    />
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={styles.modalItemTitle}>{ex.name}</Text>
                      <View style={styles.modalItemMetaRow}>
                        <Badge
                          label={ex.target_muscle}
                          color="rgba(255, 85, 0, 0.18)"
                          textColor={Colors.primary}
                        />
                        <Badge
                          label={ex.equipment_needed}
                          color="#213045"
                          textColor={Colors.textSecondary}
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                    </View>
                    {isAlreadyAdded ? (
                      <View style={styles.addedBadge}>
                        <Text style={styles.addedBadgeText}>✓ Ajouté</Text>
                      </View>
                    ) : (
                      <View style={styles.modalItemAddPill}>
                        <Text style={styles.modalItemAddText}>+ Ajouter</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
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
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  diffBtn: {
    flex: 1,
    backgroundColor: '#162235',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#24344E',
  },
  diffBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  diffBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  diffBtnTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  addExerciseLink: {
    padding: 4,
  },
  addExerciseLinkText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  exerciseCard: {
    marginBottom: 12,
  },
  exerciseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 4,
  },
  removeBtnText: {
    color: Colors.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  adjustersRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0F1624',
    padding: 10,
    borderRadius: 12,
  },
  adjusterBox: {
    flex: 1,
    alignItems: 'center',
  },
  adjusterLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#192536',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  stepBtn: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  stepValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 26,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#243248',
  },
  modalSearchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: 2,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  chipsContainer: {
    marginVertical: 10,
  },
  filterChipsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modalFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modalFilterChipFavorite: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  modalFilterChipFavoriteActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  modalFilterChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalFilterChipTextActive: {
    color: Colors.primaryText,
    fontWeight: '900',
  },
  modalFilterChipFavoriteText: {
    color: Colors.gold,
  },
  modalFilterChipFavoriteTextActive: {
    color: Colors.primaryText,
    fontWeight: '900',
  },
  modalList: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  modalEmptyBox: {
    alignItems: 'center',
    padding: 30,
    marginTop: 20,
  },
  modalEmptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  modalEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalEmptySub: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
  },
  modalItemDisabled: {
    opacity: 0.65,
    backgroundColor: '#0F172A',
  },
  modalItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemAddPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  modalItemAddText: {
    color: Colors.primaryText,
    fontSize: 12,
    fontWeight: '900',
  },
  addedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addedBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
});
