import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { WeightProgressStats } from '../../../types';
import { analyzeBmi } from '../../../utils/physiologyUtils';

interface WeightSummaryCardProps {
  stats: WeightProgressStats | null;
  weightUnit: string;
  userHeightCm?: number;
  onAddLogPress: () => void;
  onSetHeightPress?: () => void;
}

export const WeightSummaryCard: React.FC<WeightSummaryCardProps> = ({
  stats,
  weightUnit,
  userHeightCm,
  onAddLogPress,
  onSetHeightPress,
}) => {
  const bmiAnalysis =
    stats?.currentWeight && userHeightCm
      ? analyzeBmi(stats.currentWeight, userHeightCm)
      : null;

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
          <Text
            style={[
              styles.metricItemValue,
              stats && stats.deltaTotal > 0 && styles.deltaPositive,
              stats && stats.deltaTotal < 0 && styles.deltaNegative,
            ]}
          >
            {stats && stats.currentWeight !== null
              ? `${stats.deltaTotal > 0 ? '+' : ''}${stats.deltaTotal} kg`
              : '--'}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricItemLabel}>Sur 7 jours</Text>
          <Text
            style={[
              styles.metricItemValue,
              stats && stats.delta7Days > 0 && styles.deltaPositive,
              stats && stats.delta7Days < 0 && styles.deltaNegative,
            ]}
          >
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
  deltaPositive: {
    color: '#F87171',
  },
  deltaNegative: {
    color: '#4ADE80',
  },
  bmiCategorySubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 1,
  },
});
