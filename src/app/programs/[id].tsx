import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
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

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<ProgramExerciseDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const startWorkoutFromProgram = useWorkoutSessionStore(
    (state) => state.startWorkoutFromProgram
  );

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
    load();
  }, [id]);

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
    await startWorkoutFromProgram(program.id);
    router.push('/workout/active');
  };

  const handleDelete = () => {
    Alert.alert(
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

        {/* Bouton Démarrer géant */}
        <Button
          title="Démarrer la séance ▶"
          size="lg"
          variant="primary"
          onPress={handleStartWorkout}
          style={styles.startBtn}
        />

        {/* Liste des exercices prévus */}
        <Text style={styles.sectionTitle}>
          Exercices inclus ({exercises.length})
        </Text>

        {exercises.map((item, idx) => (
          <Card key={item.id || idx} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>{idx + 1}</Text>
              <ExerciseIllustration
                exerciseId={item.exercise_id}
                targetMuscle={item.target_muscle}
                size={46}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {item.target_muscle} • {item.equipment_needed}
                </Text>
              </View>
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
});
