import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllExercises } from '../../database/exerciseRepository';
import { createCustomProgram } from '../../database/programRepository';
import { Exercise, DifficultyLevel } from '../../types';
import { DIFFICULTY_LEVELS } from '../../constants/muscles';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  isDurationExercise,
  getExerciseUnitInfo,
  isExerciseCompatibleWithEquipment,
} from '../../utils/exerciseUnits';

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
  const [saving, setSaving] = useState(false);

  const { available_equipments, filter_by_available_equipment } = useSettingsStore();

  const filteredModalExercises = React.useMemo(() => {
    if (!filter_by_available_equipment) return allExercises;
    return allExercises.filter((ex) =>
      isExerciseCompatibleWithEquipment(ex, available_equipments)
    );
  }, [allExercises, filter_by_available_equipment, available_equipments]);

  useEffect(() => {
    async function load() {
      const list = await getAllExercises();
      setAllExercises(list);
    }
    load();
  }, []);

  const handleAddExercise = (exercise: Exercise) => {
    // Éviter les doublons
    if (selectedExercises.some((item) => item.exercise.id === exercise.id)) {
      Alert.alert('Exercice déjà ajouté', 'Cet exercice est déjà dans la liste.');
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
      Alert.alert('Nom requis', 'Veuillez saisir un nom pour votre programme.');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert(
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

      Alert.alert('Succès', 'Votre programme a été créé avec succès !', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d’enregistrer le programme.');
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                    <Badge
                      label={item.exercise.target_muscle}
                      color="#213045"
                      textColor={Colors.textSecondary}
                      style={{ marginTop: 4 }}
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
            <Text style={styles.modalTitle}>Sélectionner un exercice</Text>
            <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredModalExercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={styles.modalItem}
                onPress={() => handleAddExercise(ex)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemTitle}>{ex.name}</Text>
                  <Text style={styles.modalItemSub}>
                    {ex.target_muscle} • {ex.equipment_needed}
                  </Text>
                </View>
                <Text style={styles.modalItemAdd}>+</Text>
              </TouchableOpacity>
            ))}
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
  modalList: {
    padding: 16,
    paddingBottom: 40,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121A28',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2A3D',
  },
  modalItemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  modalItemSub: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  modalItemAdd: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 12,
  },
});
