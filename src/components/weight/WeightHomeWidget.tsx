import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BodyWeightLog, FitnessGoal } from '../../types';
import { getLatestWeightLog } from '../../database/weightRepository';
import { getTargetWeightGoal } from '../../database/goalRepository';
import { parseWeightGoalTitle } from '../../utils/physiologyUtils';

interface WeightHomeWidgetProps {
  onPress?: () => void;
  refreshTrigger?: number;
}

export const WeightHomeWidget: React.FC<WeightHomeWidgetProps> = ({ onPress, refreshTrigger }) => {
  const [latestLog, setLatestLog] = useState<BodyWeightLog | null>(null);
  const [weightGoal, setWeightGoal] = useState<FitnessGoal | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [log, goal] = await Promise.all([
        getLatestWeightLog(),
        getTargetWeightGoal(),
      ]);
      setLatestLog(log);
      setWeightGoal(goal);
    } catch {
      // Ignorer silencieusement si la table vient d'être créée
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (isMounted) {
        await loadData();
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [loadData, refreshTrigger]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/history?tab=weight_goals');
    }
  };

  const goalInfo = weightGoal ? parseWeightGoalTitle(weightGoal.title) : null;

  const progressPercent = (() => {
    if (!latestLog || !weightGoal) return null;
    const start = weightGoal.starting_value;
    const target = weightGoal.target_value;
    const current = latestLog.weight;
    const type = goalInfo?.goalType || (start > target ? 'loss' : 'bulk');

    if (type === 'maintain') {
      const diff = Math.abs(current - target);
      return diff <= 1.5 ? 100 : Math.max(0, Math.min(100, Math.round(100 - diff * 20)));
    }

    if (type === 'bulk') {
      const totalDiff = Math.max(0.5, target - start);
      const gain = current - start;
      return Math.max(0, Math.min(100, Math.round((gain / totalDiff) * 100)));
    }

    // loss
    const totalDiff = Math.max(0.5, start - target);
    const loss = start - current;
    return Math.max(0, Math.min(100, Math.round((loss / totalDiff) * 100)));
  })();

  const goalTypeLabel = (() => {
    if (!goalInfo) return '';
    switch (goalInfo.goalType) {
      case 'bulk':
        return 'Prise de masse';
      case 'maintain':
        return 'Maintien';
      case 'loss':
      default:
        return 'Sèche';
    }
  })();

  const widgetIcon = (() => {
    if (!goalInfo) return '⚖️';
    switch (goalInfo.goalType) {
      case 'bulk':
        return '📈';
      case 'maintain':
        return '⚖️';
      case 'loss':
      default:
        return '📉';
    }
  })();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.iconBox}>
        <Text style={styles.iconEmoji}>{widgetIcon}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Suivi du Poids & Objectifs</Text>
          {weightGoal && progressPercent !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{progressPercent}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.subtitle} numberOfLines={1}>
          {latestLog
            ? `Poids : ${latestLog.weight} kg${
                weightGoal ? ` • ${goalTypeLabel} (${weightGoal.target_value} kg)` : ''
              }`
            : 'Enregistrez votre première pesée et vos objectifs'}
        </Text>
      </View>

      <Text style={styles.arrow}>❯</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162235',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#263750',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0E1726',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#374B6B',
  },
  iconEmoji: {
    fontSize: 22,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  badgeText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  arrow: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
});
