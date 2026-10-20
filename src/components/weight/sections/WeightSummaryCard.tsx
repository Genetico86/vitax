import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { WeightProgressStats } from '../../../types';
import { analyzeBmi, WeightGoalType } from '../../../utils/physiologyUtils';

interface WeightSummaryCardProps {
  stats: WeightProgressStats | null;
  weightUnit: string;
  userHeightCm?: number;
  goalType?: WeightGoalType;
  onAddLogPress: () => void;
  onSetHeightPress?: () => void;
}

export const WeightSummaryCard: React.FC<WeightSummaryCardProps> = ({
  stats,
  weightUnit,
  userHeightCm,
  goalType,
  onAddLogPress,
  onSetHeightPress,
}) => {
  const bmiAnalysis =
    stats?.currentWeight && userHeightCm
      ? analyzeBmi(stats.currentWeight, userHeightCm)
      : null;

  // Calcul intelligent des couleurs de delta selon l'objectif de l'athlète
  const getDeltaColor = (delta: number) => {
    if (delta === 0) return '#38BDF8';

    if (goalType === 'bulk') {
      // En prise de masse, un gain modéré est vert, une perte est ambre
      return delta > 0 ? '#4ADE80' : '#F59E0B';
    }

    if (goalType === 'maintain') {
      // En maintien, une variation faible (<= 0.8 kg) est verte
      return Math.abs(delta) <= 0.8 ? '#4ADE80' : '#F59E0B';
    }

    if (goalType === 'loss') {
      // En sèche, une perte est verte, un gain est ambre
      return delta < 0 ? '#4ADE80' : '#F59E0B';
    }

    // Sans objectif explicite, affichage informatif neutre
    return '#38BDF8';
  };

  const deltaTotalColor = stats ? getDeltaColor(stats.deltaTotal) : '#94A3B8';
  const delta7DaysColor = stats ? getDeltaColor(stats.delta7Days) : '#94A3B8';

  return (
    <Card style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View>
          <Text style={styles.summaryLabel}>Poids Actuel</Text>
          <View style={styles.weightValueRow}>
            <Text style={styles.currentWeightNumber}>
              {stats?.currentWeight ? `${stats.currentWeight}` : '--'}
            </Text>
            <Text style={styles.weightUnitText}>{weightUnit}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addLogBtn}
          onPress={onAddLogPress}
          activeOpacity={0.8}
        >
          <Text style={styles.addLogBtnIcon}>⚖️</Text>
          <Text style={styles.addLogBtnText}>+ Pesée</Text>
        </TouchableOpacity>
      </View>

      {/* Ligne d'indicateurs rapides */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricItemLabel}>Évolution totale</Text>
          <Text style={[styles.metricItemValue, { color: deltaTotalColor }]}>
            {stats && stats.currentWeight !== null
              ? `${stats.deltaTotal > 0 ? '+' : ''}${stats.deltaTotal} kg`
              : '--'}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricItemLabel}>Sur 7 jours</Text>
          <Text style={[styles.metricItemValue, { color: delta7DaysColor }]}>
            {stats && stats.delta7Days !== 0
              ? `${stats.delta7Days > 0 ? '+' : ''}${stats.delta7Days} kg`
              : 'Stable'}
          </Text>
        </View>

        {bmiAnalysis ? (
          <TouchableOpacity
            style={styles.metricItem}
            onPress={onSetHeightPress}
            activeOpacity={0.7}
          >
            <Text style={styles.metricItemLabel}>IMC estimé</Text>
            <Text style={[styles.metricItemValue, { color: bmiAnalysis.color }]}>
              {bmiAnalysis.bmi}
            </Text>
            <Text style={[styles.bmiCategorySubtitle, { color: bmiAnalysis.color }]}>
              {bmiAnalysis.categoryShort}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.metricItem}
            onPress={onSetHeightPress}
            activeOpacity={0.7}
          >
            <Text style={styles.metricItemLabel}>IMC</Text>
            <Text style={[styles.metricItemValue, { color: '#38BDF8', fontSize: 13 }]}>
              + Taille
            </Text>
            <Text style={styles.bmiCategorySubtitle}>Calculer</Text>
          </TouchableOpacity>
        )}

        <View style={styles.metricItem}>
          <Text style={styles.metricItemLabel}>Pesées</Text>
          <Text style={styles.metricItemValue}>{stats?.logsCount ?? 0}</Text>
        </View>
      </View>

      {/* Mini bandeau d'orientation selon l'objectif */}
      {goalType && stats?.currentWeight && (
        <View style={styles.goalHintRow}>
          <Text style={styles.goalHintText}>
            {goalType === 'bulk'
              ? '📈 Suivi calé sur votre Prise de masse (les gains pondérés sont comptés positivement).'
              : goalType === 'maintain'
              ? '⚖️ Suivi calé sur votre Maintien / Recomposition (zone de stabilité ±0,8 kg).'
              : '📉 Suivi calé sur votre Sèche / Perte de poids progressive.'}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#121A28',
    borderColor: '#1E2B3E',
    marginBottom: 16,
    padding: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  weightValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  currentWeightNumber: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  weightUnitText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 6,
  },
  addLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addLogBtnIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  addLogBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0A121E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#162232',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricItemLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  metricItemValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bmiCategorySubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 1,
  },
  goalHintRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#172233',
  },
  goalHintText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});
