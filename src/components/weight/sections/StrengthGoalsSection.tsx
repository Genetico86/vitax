import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import { FitnessGoal } from '../../../types';

interface StrengthGoalsSectionProps {
  goals: FitnessGoal[];
  onAddGoalPress: () => void;
  onDeleteGoal: (id: string, title: string) => void;
}

export const StrengthGoalsSection: React.FC<StrengthGoalsSectionProps> = ({
  goals,
  onAddGoalPress,
  onDeleteGoal,
}) => {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>💪 Objectifs de Force</Text>
        <TouchableOpacity
          onPress={onAddGoalPress}
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
            onPress={onAddGoalPress}
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
                  onPress={() => onDeleteGoal(goal.id, goal.exercise_name || goal.title)}
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
    </View>
  );
};

const styles = StyleSheet.create({
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
});
