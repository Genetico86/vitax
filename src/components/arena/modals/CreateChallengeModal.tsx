import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { Exercise, Program } from '../../../types';
import { FriendEntry } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface CreateChallengeModalProps {
  visible: boolean;
  allExercises: Exercise[];
  allPrograms: Program[];
  friendsList: FriendEntry[];
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

const CreateChallengeModalContent: React.FC<{
  allExercises: Exercise[];
  allPrograms: Program[];
  friendsList: FriendEntry[];
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
}> = ({ allExercises, allPrograms, friendsList, onClose, onSubmit }) => {
  const [challengeType, setChallengeType] = useState<'exercise' | 'program'>('exercise');
  const [selectedExerciseId, setSelectedExerciseId] = useState(allExercises[0]?.id || '');
  const [selectedProgramId, setSelectedProgramId] = useState(allPrograms[0]?.id || '');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetRepsInput, setTargetRepsInput] = useState('10');
  const [targetVolumeInput, setTargetVolumeInput] = useState('3000');
  const [challengeInstructionsInput, setChallengeInstructionsInput] = useState('');
  const [targetFriendCodeInput, setTargetFriendCodeInput] = useState('all');
  const [createChallengeLoading, setCreateChallengeLoading] = useState(false);

  const handleSubmit = async () => {
    setCreateChallengeLoading(true);
    const success = await onSubmit({
      type: challengeType,
      selectedExerciseId: challengeType === 'exercise' ? selectedExerciseId : undefined,
      selectedProgramId: challengeType === 'program' ? selectedProgramId : undefined,
      targetWeight: targetWeightInput ? parseFloat(targetWeightInput) : undefined,
      targetReps: targetRepsInput ? parseInt(targetRepsInput, 10) : undefined,
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
      <View style={[styles.modalCard, { maxHeight: '88%' }]}>
        <Text style={styles.modalTitle}>Créer un Défi Sportif 🥊</Text>
        <Text style={styles.modalSub}>
          Fixez un objectif avec vos stats à dépasser pour vos amis !
        </Text>

        <ScrollView style={{ marginVertical: 10 }}>
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
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Sélectionner l’exercice</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {allExercises.slice(0, 16).map((ex) => {
                  const isSel = (selectedExerciseId || allExercises[0]?.id) === ex.id;
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={[
                        styles.chipSelectItem,
                        isSel && styles.chipSelectItemActive,
                      ]}
                      onPress={() => setSelectedExerciseId(ex.id)}
                    >
                      <Text
                        style={[
                          styles.chipSelectText,
                          isSel && styles.chipSelectTextActive,
                        ]}
                      >
                        {ex.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Charge cible (kg)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Ex: 80"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={targetWeightInput}
                    onChangeText={setTargetWeightInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Reps cibles</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Ex: 10"
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
            placeholder="Ex: Forme stricte requise, bats mes répétitions si tu l'oses !"
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

export const CreateChallengeModal: React.FC<CreateChallengeModalProps> = ({
  visible,
  allExercises,
  allPrograms,
  friendsList,
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
          allExercises={allExercises}
          allPrograms={allPrograms}
          friendsList={friendsList}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
