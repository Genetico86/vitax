import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { Badge } from '../../common/Badge';
import { FitnessGoal } from '../../../types';

interface WeightGoalCardProps {
  weightGoal: FitnessGoal | null;
  weightGoalProgress: {
    percent: number;
    isLosing: boolean;
    remainingKg: number;
    achieved: boolean;
  } | null;
  currentWeight?: number | null;
  onSetOrEditGoalPress: () => void;
}

export const WeightGoalCard: React.FC<WeightGoalCardProps> = ({
  weightGoal,
  weightGoalProgress,
  currentWeight,
  onSetOrEditGoalPress,
}) => {
  return (
    <View>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🎯 Objectif de Poids</Text>
        <TouchableOpacity
          onPress={onSetOrEditGoalPress}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionActionText}>
            {weightGoal ? 'Modifier ❯' : '+ Définir ❯'}
          </Text>
        </TouchableOpacity>
      </View>

      {weightGoal ? (
        <Card style={styles.goalCard}>
          <View style={styles.goalCardHeader}>
            <View style={styles.goalIconCircle}>
              <Text style={{ fontSize: 20 }}>
                {weightGoalProgress?.achieved ? '🏆' : '⚖️'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.goalBadgeRow}>
                <Badge
                  label={weightGoalProgress?.isLosing ? 'Sèche / Perte' : 'Prise de masse'}
                  color="rgba(59, 130, 246, 0.2)"
                  textColor="#60A5FA"
                />
                {weightGoalProgress?.achieved && (
                  <Badge
                    label="🎉 Objectif Atteint !"
                    color="rgba(34, 197, 94, 0.25)"
                    textColor="#4ADE80"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
              <Text style={styles.goalTitle}>
                Cible : {weightGoal.target_value} kg
              </Text>
            </View>
          </View>

          {/* Jauge de progression */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${weightGoalProgress?.percent ?? 0}%` },
                weightGoalProgress?.achieved && { backgroundColor: '#10B981' },
              ]}
            />
          </View>

          <View style={styles.goalFooterRow}>
            <Text style={styles.goalFooterSub}>
              Départ : {weightGoal.starting_value} kg • Actuel : {currentWeight ?? '--'} kg
            </Text>
            <Text style={styles.goalFooterPercent}>
              {weightGoalProgress?.percent}%
            </Text>
          </View>

          {!weightGoalProgress?.achieved && (
            <Text style={styles.goalRemainingText}>
              Encore {weightGoalProgress?.remainingKg} kg pour valider votre objectif !
            </Text>
          )}
        </Card>
      ) : (
        <Card style={styles.emptyGoalCard}>
          <Text style={{ fontSize: 26, marginBottom: 6 }}>🎯</Text>
          <Text style={styles.emptyGoalTitle}>Aucun objectif de poids fixé</Text>
          <Text style={styles.emptyGoalSub}>
            Définissez un poids cible pour suivre votre progression pas à pas.
          </Text>
          <Button
            title="+ Définir un poids cible"
            variant="outline"
            size="sm"
            onPress={onSetOrEditGoalPress}
            style={{ marginTop: 10 }}
          />
        </Card>
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
  goalCard: {
    backgroundColor: '#131D2D',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    marginBottom: 14,
    padding: 14,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E2C44',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2F456A',
  },
  goalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  goalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
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
  goalRemainingText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
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
});
