import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { BodyWeightLog } from '../../../types';

interface WeightHistoryChartProps {
  chartLogs: BodyWeightLog[];
}

export const WeightHistoryChart: React.FC<WeightHistoryChartProps> = ({ chartLogs }) => {
  if (chartLogs.length <= 1) return null;

  const weights = chartLogs.map((l) => l.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = Math.max(1, maxW - minW);

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Tendance des pesées</Text>
        <Text style={styles.chartSub}>
          {chartLogs.length} dernières pesées
        </Text>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.barsRow}>
          {chartLogs.map((item, idx) => {
            const heightPercent = Math.max(15, Math.min(100, ((item.weight - minW) / range) * 100));
            const isLatest = idx === chartLogs.length - 1;

            return (
              <View key={item.id} style={styles.barCol}>
                <Text style={[styles.barWeightText, isLatest && styles.barWeightTextLatest]}>
                  {item.weight}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPercent}%` },
                      isLatest && styles.barFillLatest,
                    ]}
                  />
                </View>
                <Text style={styles.barDateText}>
                  {item.date.slice(5)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#111A29',
    borderColor: '#1D2A3E',
    marginBottom: 18,
    padding: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  chartSub: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  chartContainer: {
    height: 110,
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 90,
    paddingBottom: 4,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barWeightText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  barWeightTextLatest: {
    color: Colors.primary,
    fontWeight: '800',
  },
  barTrack: {
    height: 60,
    width: 14,
    backgroundColor: '#1A2536',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    width: '100%',
  },
  barFillLatest: {
    backgroundColor: Colors.primary,
  },
  barDateText: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },
});
