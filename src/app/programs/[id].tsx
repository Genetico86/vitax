import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getProgramById, deleteCustomProgram } from '../../database/programRepository';
import { Program, ProgramExerciseDetail } from '../../types';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import { getExerciseUnitInfo } from '../../utils/exerciseUnits';
import {
  getFavoriteExerciseIds,
  toggleFavoriteExercise,
} from '../../services/favoritesService';
import { ExerciseGuideModal } from '../../components/workout/ExerciseGuideModal';
import { showAlert } from '../../utils/alert';

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<ProgramExerciseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [selectedGuideExercise, setSelectedGuideExercise] = useState<{
    id: string;
    name: string;
    target_muscle?: string;
    equipment_needed?: string;
  } | null>(null);

  const { isActive, programName, startWorkoutFromProgram } = useWorkoutSessionStore();

  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await getProgramById(id);
      if (data) {
        setProgram(data.program);
        setExercises(data.exercises);
      }
      setLoading(false);
    }
    async function loadFavorites() {
      const favs = await getFavoriteExerciseIds();
      setFavoriteIds(favs);
    }
    load();
    loadFavorites();
  }, [id]);

  const handleToggleFavorite = async (exerciseId: string) => {
    await toggleFavoriteExercise(exerciseId);
    const updated = await getFavoriteExerciseIds();
    setFavoriteIds(updated);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Programme introuvable</Text>
      </View>
    );
  }

  const handleStartWorkout = async () => {
    if (isActive) {
      showAlert(
        'Séance déjà en cours ⚡',
        `La séance « ${programName || 'Séance libre'} » est actuellement en cours. Voulez-vous la remplacer par « ${program.name} » ?`,
        [
          {
            text: 'Reprendre en cours',
            style: 'cancel',
            onPress: () => router.push('/workout/active'),
          },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: async () => {
              await startWorkoutFromProgram(program.id);
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await startWorkoutFromProgram(program.id);
    router.push('/workout/active');
  };

  const handleDelete = () => {
    showAlert(
      'Supprimer le programme',
      'Voulez-vous vraiment supprimer ce programme personnalisé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomProgram(program.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* En-tête du programme */}
        <View style={styles.header}>
          <View style={styles.badgesRow}>
            <Badge
              label={program.difficulty_level}
              color="rgba(255, 90, 31, 0.2)"
              textColor={Colors.primary}
            />
            {program.is_custom === 1 && (
              <Badge
                label="Personnalisé"
                color="rgba(147, 51, 234, 0.2)"
                textColor="#C084FC"
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
          <Text style={styles.title}>{program.name}</Text>
          <Text style={styles.description}>{program.description}</Text>
        </View>

        {/* Boutons Démarrer et Défier le programme en 1 clic */}
        <View style={styles.programActionRow}>
          <Button
            title="Démarrer la séance ▶"
            size="lg"
            variant="primary"
            onPress={handleStartWorkout}
            style={{ flex: 1.35 }}
          />
          <TouchableOpacity
            style={styles.challengeProgramLargeBtn}
            onPress={() => {
              router.push({
                pathname: '/arena',
                params: {
                  openChallenge: '1',
                  challengeType: 'program',
                  programId: program.id,
                },
              });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.challengeProgramLargeBtnText}>⚔️ Défier</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des exercices prévus */}
        <Text style={styles.sectionTitle}>
          Exercices inclus ({exercises.length})
        </Text>

        {exercises.map((item, idx) => (
          <Card key={item.id || idx} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>{idx + 1}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedGuideExercise({
                    id: item.exercise_id,
                    name: item.name,
                    target_muscle: item.target_muscle,
                    equipment_needed: item.equipment_needed,
                  });
                  setGuideModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <ExerciseIllustration
                  exerciseId={item.exercise_id}
                  targetMuscle={item.target_muscle}
                  size={46}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, marginLeft: 10 }}
                onPress={() => {
                  setSelectedGuideExercise({
                    id: item.exercise_id,
                    name: item.name,
                    target_muscle: item.target_muscle,
                    equipment_needed: item.equipment_needed,
                  });
                  setGuideModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseName}>{item.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {item.target_muscle} • {item.equipment_needed}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedGuideExercise({
                    id: item.exercise_id,
                    name: item.name,
                    target_muscle: item.target_muscle,
                    equipment_needed: item.equipment_needed,
                  });
                  setGuideModalVisible(true);
                }}
                style={styles.guideCardBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.guideCardBtnIcon}>ℹ️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleToggleFavorite(item.exercise_id)}
                style={[
                  styles.favoriteCardBtn,
                  favoriteIds.includes(item.exercise_id) && styles.favoriteCardBtnActive,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.favoriteCardBtnIcon}>
                  {favoriteIds.includes(item.exercise_id) ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: '/arena',
                    params: {
                      openChallenge: '1',
                      challengeType: 'exercise',
                      exerciseId: item.exercise_id,
                    },
                  });
                }}
                style={styles.challengeCardMiniBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.challengeCardMiniBtnText}>⚔️</Text>
              </TouchableOpacity>
            </View>

            {item.description ? (
              <Text style={styles.exerciseInstruction} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            {(() => {
              const unitInfo = getExerciseUnitInfo({
                id: item.exercise_id,
                name: item.name,
                equipment_needed: item.equipment_needed,
              });

              return (
                <View style={styles.paramsRow}>
                  <View style={styles.paramBox}>
                    <Text style={styles.paramLabel}>Séries</Text>
                    <Text style={styles.paramValue}>{item.default_sets}</Text>
                  </View>
                  <View style={styles.paramBox}>
                    <Text style={styles.paramLabel}>
                      {unitInfo.isDuration ? 'Durée cible' : 'Reps cibles'}
                    </Text>
                    <Text style={styles.paramValue}>
                      {item.default_reps} {unitInfo.valueUnit}
                    </Text>
                  </View>
                  <View style={styles.paramBox}>
                    <Text style={styles.paramLabel}>Repos</Text>
                    <Text style={styles.paramValue}>{item.rest_time_seconds}s</Text>
                  </View>
                </View>
              );
            })()}
          </Card>
        ))}

        {program.is_custom === 1 && (
          <Button
            title="Supprimer ce programme"
            variant="danger"
            size="sm"
            onPress={handleDelete}
            style={{ marginTop: 20 }}
          />
        )}
      </ScrollView>

      {/* Modal du guide d'exécution technique */}
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
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  startBtn: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  exerciseCard: {
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceBorder,
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 10,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  exerciseInstruction: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  paramsRow: {
    flexDirection: 'row',
    backgroundColor: '#0F1624',
    borderRadius: 10,
    padding: 8,
  },
  paramBox: {
    flex: 1,
    alignItems: 'center',
  },
  paramLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  paramValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  guideCardBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  guideCardBtnIcon: {
    fontSize: 15,
  },
  favoriteCardBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#24344E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  favoriteCardBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  favoriteCardBtnIcon: {
    fontSize: 16,
  },
  programActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  challengeProgramLargeBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 90, 31, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeProgramLargeBtnText: {
    color: '#FF7A45',
    fontSize: 15,
    fontWeight: '900',
  },
  challengeCardMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 90, 31, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  challengeCardMiniBtnText: {
    fontSize: 15,
  },
});
