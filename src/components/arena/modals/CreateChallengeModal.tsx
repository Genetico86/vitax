import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { Exercise, Program } from '../../../types';
import { FriendEntry } from '../../../types/social';
import { isDurationExercise, getExerciseUnitInfo } from '../../../utils/exerciseUnits';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface CreateChallengeModalProps {
  visible: boolean;
  allExercises: Exercise[];
  allPrograms: Program[];
  friendsList: FriendEntry[];
  initialType?: 'exercise' | 'program';
  initialExerciseId?: string;
  initialProgramId?: string;
  initialWeight?: number;
  initialReps?: number;
  initialVolume?: number;
  onClose: () => void;
  onSubmit: (params: {
    type: 'exercise' | 'program';
    selectedExerciseId?: string;
    selectedProgramId?: string;
    targetWeight?: number;
    targetReps?: number;
    targetVolume?: number;
    targetFriendCodeInput: string;
    instructions?: string;
  }) => Promise<boolean>;
}

const DEFAULT_CATEGORIES = [
  'Tous',
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Jambes',
  'Abdominaux',
  'Cardio',
  'Corps Entier',
];

const CreateChallengeModalContent: React.FC<{
  allExercises: Exercise[];
  allPrograms: Program[];
  friendsList: FriendEntry[];
  initialType?: 'exercise' | 'program';
  initialExerciseId?: string;
  initialProgramId?: string;
  initialWeight?: number;
  initialReps?: number;
  initialVolume?: number;
  onClose: () => void;
  onSubmit: (params: {
    type: 'exercise' | 'program';
    selectedExerciseId?: string;
    selectedProgramId?: string;
    targetWeight?: number;
    targetReps?: number;
    targetVolume?: number;
    targetFriendCodeInput: string;
    instructions?: string;
  }) => Promise<boolean>;
}> = ({
  allExercises,
  allPrograms,
  friendsList,
  initialType,
  initialExerciseId,
  initialProgramId,
  initialWeight,
  initialReps,
  initialVolume,
  onClose,
  onSubmit,
}) => {
  const [challengeType, setChallengeType] = useState<'exercise' | 'program'>(initialType || 'exercise');
  const [selectedExerciseId, setSelectedExerciseId] = useState(initialExerciseId || allExercises[0]?.id || '');
  const [selectedProgramId, setSelectedProgramId] = useState(initialProgramId || allPrograms[0]?.id || '');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedMuscleCategory, setSelectedMuscleCategory] = useState<string>('Tous');
  const [targetWeightInput, setTargetWeightInput] = useState(
    initialWeight !== undefined && initialWeight > 0 ? String(initialWeight) : ''
  );
  const [targetRepsInput, setTargetRepsInput] = useState(
    initialReps !== undefined && initialReps > 0 ? String(initialReps) : '10'
  );
  const [targetVolumeInput, setTargetVolumeInput] = useState(
    initialVolume !== undefined && initialVolume > 0 ? String(initialVolume) : '3000'
  );
  const [challengeInstructionsInput, setChallengeInstructionsInput] = useState('');
  const [targetFriendCodeInput, setTargetFriendCodeInput] = useState('all');
  const [createChallengeLoading, setCreateChallengeLoading] = useState(false);

  // Catégories musculaires dynamiques
  const muscleCategories = useMemo(() => {
    const cats = new Set<string>();
    allExercises.forEach((ex) => {
      if (ex.target_muscle) cats.add(ex.target_muscle);
    });
    const result: string[] = ['Tous'];
    DEFAULT_CATEGORIES.forEach((c) => {
      if (c !== 'Tous' && cats.has(c)) {
        result.push(c);
        cats.delete(c);
      }
    });
    cats.forEach((c) => result.push(c));
    return result;
  }, [allExercises]);

  // Filtrage parmi l'ensemble des 107 exercices
  const filteredExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    return allExercises.filter((ex) => {
      const matchesCategory =
        selectedMuscleCategory === 'Tous' ||
        ex.target_muscle?.toLowerCase() === selectedMuscleCategory.toLowerCase();
      if (!matchesCategory) return false;

      if (!query) return true;
      return (
        ex.name.toLowerCase().includes(query) ||
        (ex.target_muscle && ex.target_muscle.toLowerCase().includes(query)) ||
        (ex.equipment_needed && ex.equipment_needed.toLowerCase().includes(query))
      );
    });
  }, [allExercises, exerciseSearch, selectedMuscleCategory]);

  // Exercice sélectionné actuel
  const selectedExercise = useMemo(() => {
    return allExercises.find((ex) => ex.id === selectedExerciseId) || allExercises[0];
  }, [allExercises, selectedExerciseId]);

  const isDuration = useMemo(() => {
    return isDurationExercise(selectedExercise);
  }, [selectedExercise]);

  const unitInfo = useMemo(() => {
    return getExerciseUnitInfo(selectedExercise);
  }, [selectedExercise]);

  const handleSelectExercise = (ex: Exercise) => {
    setSelectedExerciseId(ex.id);
    const cardio = isDurationExercise(ex);
    if (cardio && (!targetRepsInput || targetRepsInput === '10')) {
      setTargetRepsInput('15');
    } else if (!cardio && targetRepsInput === '15') {
      setTargetRepsInput('10');
    }
  };

  const handleSubmit = async () => {
    setCreateChallengeLoading(true);
    const finalExId = selectedExerciseId || allExercises[0]?.id;
    const chosenEx = allExercises.find((e) => e.id === finalExId) || allExercises[0];
    const exDuration = isDurationExercise(chosenEx);
    const defaultReps = exDuration ? 15 : 10;
    const targetReps = targetRepsInput ? parseInt(targetRepsInput, 10) : defaultReps;

    const success = await onSubmit({
      type: challengeType,
      selectedExerciseId: challengeType === 'exercise' ? finalExId : undefined,
      selectedProgramId: challengeType === 'program' ? selectedProgramId : undefined,
      targetWeight: targetWeightInput ? parseFloat(targetWeightInput) : undefined,
      targetReps,
      targetVolume: targetVolumeInput ? parseInt(targetVolumeInput, 10) : undefined,
      targetFriendCodeInput,
      instructions: challengeInstructionsInput.trim() || undefined,
    });
    setCreateChallengeLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { maxHeight: '90%' }]}>
        <Text style={styles.modalTitle}>Créer un Défi Sportif 🥊</Text>
        <Text style={styles.modalSub}>
          Fixez un objectif avec vos stats à dépasser pour vos amis !
        </Text>

        <ScrollView style={{ marginVertical: 10 }} nestedScrollEnabled>
          {/* Type de défi : Exercice vs Programme */}
          <Text style={styles.inputLabel}>Type de Défi</Text>
          <View style={styles.challengeTypeToggleRow}>
            <TouchableOpacity
              style={[
                styles.challengeTypeToggleBtn,
                challengeType === 'exercise' && styles.challengeTypeToggleBtnActive,
              ]}
              onPress={() => setChallengeType('exercise')}
            >
              <Text
                style={[
                  styles.challengeTypeToggleText,
                  challengeType === 'exercise' && styles.challengeTypeToggleTextActive,
                ]}
              >
                🏋️ Exercice Unique
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.challengeTypeToggleBtn,
                challengeType === 'program' && styles.challengeTypeToggleBtnActive,
              ]}
              onPress={() => setChallengeType('program')}
            >
              <Text
                style={[
                  styles.challengeTypeToggleText,
                  challengeType === 'program' && styles.challengeTypeToggleTextActive,
                ]}
              >
                📋 Programme Complet
              </Text>
            </TouchableOpacity>
          </View>

          {challengeType === 'exercise' ? (
            <>
              {/* Sélecteur d'exercice avec recherche et catégories */}
              <View style={{ marginTop: 12, marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>
                    Sélectionner l’exercice ({filteredExercises.length}/{allExercises.length})
                  </Text>
                  {selectedMuscleCategory !== 'Tous' && (
                    <TouchableOpacity onPress={() => setSelectedMuscleCategory('Tous')}>
                      <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '700' }}>
                        Réinitialiser
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Barre de Recherche Rapide */}
                <View style={localStyles.searchRow}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
                  <TextInput
                    style={localStyles.searchInput}
                    placeholder="Rechercher (ex: Squat, Course, DC...)"
                    placeholderTextColor={Colors.textMuted}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                    autoCorrect={false}
                  />
                  {exerciseSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setExerciseSearch('')}
                      style={localStyles.clearSearchBtn}
                    >
                      <Text style={localStyles.clearSearchText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filtres par Catégorie Musculaire */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8 }}
                >
                  {muscleCategories.map((cat) => {
                    const isCatSel = selectedMuscleCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.chipSelectItem,
                          isCatSel && styles.chipSelectItemActive,
                        ]}
                        onPress={() => setSelectedMuscleCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.chipSelectText,
                            isCatSel && styles.chipSelectTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Bannière Exercice Actuellement Sélectionné */}
                {selectedExercise && (
                  <View style={localStyles.selectedBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.selectedBannerLabel}>EXERCICE SÉLECTIONNÉ</Text>
                      <Text style={localStyles.selectedBannerTitle}>
                        {isDuration ? '🏃 ' : '🏋️ '}
                        {selectedExercise.name}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        <View style={localStyles.badgeMuscle}>
                          <Text style={localStyles.badgeMuscleText}>{selectedExercise.target_muscle}</Text>
                        </View>
                        <View style={localStyles.badgeEquipment}>
                          <Text style={localStyles.badgeEquipmentText}>
                            {selectedExercise.equipment_needed || 'Sans matériel'}
                          </Text>
                        </View>
                        <View
                          style={[
                            localStyles.badgeType,
                            isDuration ? localStyles.badgeTypeCardio : localStyles.badgeTypeForce,
                          ]}
                        >
                          <Text style={localStyles.badgeTypeText}>
                            {isDuration ? 'Cardio / Endurance' : 'Force / Muscu'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Liste déroulante des exercices filtrés */}
                <ScrollView
                  nestedScrollEnabled
                  style={localStyles.exerciseListScroll}
                  contentContainerStyle={{ paddingVertical: 4 }}
                  showsVerticalScrollIndicator={true}
                >
                  {filteredExercises.length === 0 ? (
                    <View style={localStyles.emptyExercises}>
                      <Text style={localStyles.emptyExercisesText}>
                        Aucun exercice ne correspond à votre recherche.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setExerciseSearch('');
                          setSelectedMuscleCategory('Tous');
                        }}
                        style={localStyles.resetFilterBtn}
                      >
                        <Text style={localStyles.resetFilterBtnText}>Voir tous les 107 exercices</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    filteredExercises.map((ex) => {
                      const isSel = (selectedExerciseId || allExercises[0]?.id) === ex.id;
                      const isExCardio = isDurationExercise(ex);
                      return (
                        <TouchableOpacity
                          key={ex.id}
                          style={[
                            localStyles.exerciseRow,
                            isSel && localStyles.exerciseRowSelected,
                          ]}
                          onPress={() => handleSelectExercise(ex)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                localStyles.exerciseRowName,
                                isSel && localStyles.exerciseRowNameSelected,
                              ]}
                            >
                              {isExCardio ? '🏃 ' : '🏋️ '}
                              {ex.name}
                            </Text>
                            <Text style={localStyles.exerciseRowDetails}>
                              {ex.target_muscle} • {ex.equipment_needed || 'Sans matériel'}
                            </Text>
                          </View>
                          {isSel && (
                            <View style={localStyles.checkBadge}>
                              <Text style={localStyles.checkBadgeText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>

              {/* Objectifs cibles adaptés à l'exercice */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>
                    {isDuration
                      ? unitInfo.loadLabel === 'VITESSE'
                        ? 'Vitesse cible (km/h)'
                        : 'Résistance cible'
                      : 'Charge cible (kg)'}
                  </Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder={isDuration ? 'Ex: 10' : 'Ex: 80'}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={targetWeightInput}
                    onChangeText={setTargetWeightInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>
                    {isDuration ? 'Durée cible (min)' : 'Reps cibles'}
                  </Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder={isDuration ? 'Ex: 20' : 'Ex: 10'}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={targetRepsInput}
                    onChangeText={setTargetRepsInput}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Sélectionner le programme</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {allPrograms.map((prog) => {
                  const isSel = (selectedProgramId || allPrograms[0]?.id) === prog.id;
                  return (
                    <TouchableOpacity
                      key={prog.id}
                      style={[
                        styles.chipSelectItem,
                        isSel && styles.chipSelectItemActive,
                      ]}
                      onPress={() => setSelectedProgramId(prog.id)}
                    >
                      <Text
                        style={[
                          styles.chipSelectText,
                          isSel && styles.chipSelectTextActive,
                        ]}
                      >
                        {prog.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Tonnage total cible à dépasser (kg)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Ex: 4000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={targetVolumeInput}
                onChangeText={setTargetVolumeInput}
              />
            </>
          )}

          {/* Destinataire */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Destinataire du Défi</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={[
                styles.chipSelectItem,
                targetFriendCodeInput === 'all' && styles.chipSelectItemActive,
              ]}
              onPress={() => setTargetFriendCodeInput('all')}
            >
              <Text
                style={[
                  styles.chipSelectText,
                  targetFriendCodeInput === 'all' && styles.chipSelectTextActive,
                ]}
              >
                🌐 Tous les athlètes
              </Text>
            </TouchableOpacity>
            {friendsList.map((f) => {
              const isSel = targetFriendCodeInput === f.friendCode;
              return (
                <TouchableOpacity
                  key={f.friendId}
                  style={[
                    styles.chipSelectItem,
                    isSel && styles.chipSelectItemActive,
                  ]}
                  onPress={() => setTargetFriendCodeInput(f.friendCode)}
                >
                  <Text
                    style={[
                      styles.chipSelectText,
                      isSel && styles.chipSelectTextActive,
                    ]}
                  >
                    {f.avatarPokemonEmoji} {f.username}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Message provocateur / motivation */}
          <Text style={styles.inputLabel}>Message ou consigne personnalisée</Text>
          <TextInput
            style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
            placeholder={
              isDuration
                ? "Ex: Allure régulière requise, bats mon chronomètre si tu l'oses !"
                : "Ex: Forme stricte requise, bats mes répétitions si tu l'oses !"
            }
            placeholderTextColor={Colors.textMuted}
            multiline
            value={challengeInstructionsInput}
            onChangeText={setChallengeInstructionsInput}
          />
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button
            title="Annuler"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title={createChallengeLoading ? 'Envoi...' : 'Lancer le Défi ⚔️'}
            variant="primary"
            size="md"
            onPress={handleSubmit}
            disabled={createChallengeLoading}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1626',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354D',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedBanner: {
    backgroundColor: '#172236',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  selectedBannerLabel: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectedBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeMuscle: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.3)',
  },
  badgeMuscleText: {
    color: '#FF8A50',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeEquipment: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeEquipmentText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeType: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTypeCardio: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  badgeTypeForce: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeTypeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseListScroll: {
    maxHeight: 160,
    backgroundColor: '#0A0F1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#141D2C',
  },
  exerciseRowSelected: {
    backgroundColor: 'rgba(255, 90, 31, 0.14)',
    borderColor: 'rgba(255, 90, 31, 0.4)',
    borderWidth: 1,
  },
  exerciseRowName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseRowNameSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  exerciseRowDetails: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyExercises: {
    padding: 16,
    alignItems: 'center',
  },
  emptyExercisesText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  resetFilterBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resetFilterBtnText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});

export const CreateChallengeModal: React.FC<CreateChallengeModalProps> = ({
  visible,
  allExercises,
  allPrograms,
  friendsList,
  initialType,
  initialExerciseId,
  initialProgramId,
  initialWeight,
  initialReps,
  initialVolume,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible ? (
        <CreateChallengeModalContent
          key={`${initialType || 'exercise'}_${initialExerciseId || ''}_${initialProgramId || ''}_${initialWeight || ''}_${initialReps || ''}`}
          allExercises={allExercises}
          allPrograms={allPrograms}
          friendsList={friendsList}
          initialType={initialType}
          initialExerciseId={initialExerciseId}
          initialProgramId={initialProgramId}
          initialWeight={initialWeight}
          initialReps={initialReps}
          initialVolume={initialVolume}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
