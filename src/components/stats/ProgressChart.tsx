import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { ExerciseHistoryPoint } from '../../types';
import { Colors } from '../../constants/colors';
import { getExerciseUnitInfo } from '../../utils/exerciseUnits';

interface ProgressChartProps {
  data: ExerciseHistoryPoint[];
  metric?: 'max_weight' | 'max_reps' | 'estimated_1rm' | 'total_volume';
  exercise?: { id?: string; name?: string; equipment_needed?: string };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 180;
const PADDING = 30;

export const ProgressChart: React.FC<ProgressChartProps> = ({
  data,
  metric = 'max_weight',
  exercise,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>Aucune donnée enregistrée</Text>
        <Text style={styles.emptyText}>
          Validez des séries lors de vos entraînements pour voir votre courbe de progression
          se construire automatiquement !
        </Text>
      </View>
    );
  }

  const unitInfo = getExerciseUnitInfo(exercise);
  const values = data.map((d) => d[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const getUnit = () => {
    if (unitInfo.isDuration) {
      if (metric === 'total_volume') return 'min tot.';
      if (metric === 'max_reps') return 'min';
      return unitInfo.loadUnit;
    }
    if (metric === 'total_volume') return 'kg vol.';
    if (metric === 'max_reps') return 'reps';
    return 'kg';
  };

  const getLabel = () => {
    if (unitInfo.isDuration) {
      switch (metric) {
        case 'max_weight':
          return `${unitInfo.loadLabel} Max (${unitInfo.loadUnit})`;
        case 'max_reps':
          return 'Durée Maximale (min)';
        case 'estimated_1rm':
          return `Intensité Max (${unitInfo.loadUnit})`;
        case 'total_volume':
          return 'Durée Totale (min)';
      }
    }
    switch (metric) {
      case 'max_weight':
        return 'Charge Maximale';
      case 'max_reps':
        return 'Répétitions Max';
      case 'estimated_1rm':
        return '1RM Estimé (Record Théorique)';
      case 'total_volume':
        return 'Volume Total';
    }
  };

  // Calcul des coordonnées SVG
  const points = data.map((item, idx) => {
    const x =
      data.length === 1
        ? CHART_WIDTH / 2
        : PADDING + (idx / (data.length - 1)) * (CHART_WIDTH - PADDING * 2);
    const y =
      CHART_HEIGHT -
      PADDING -
      ((item[metric] - minVal) / range) * (CHART_HEIGHT - PADDING * 2);
    return { x, y, val: item[metric], date: item.date };
  });

  // Construction du chemin SVG (Line & Area)
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    linePath += ` L ${points[i].x} ${points[i].y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    CHART_HEIGHT - PADDING
  } L ${points[0].x} ${CHART_HEIGHT - PADDING} Z`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.metricLabel}>{getLabel()}</Text>
        <Text style={styles.currentValue}>
          {values[values.length - 1]} {getUnit()}
        </Text>
      </View>

      {data.length === 1 && (
        <Text style={styles.singlePointHint}>
          🎯 1ère séance enregistrée ! Vos prochaines séances traceront la courbe d’évolution.
        </Text>
      )}

      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.primary} stopOpacity="0.4" />
            <Stop offset="1" stopColor={Colors.primary} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Lignes de repères */}
        <Line
          x1={PADDING}
          y1={CHART_HEIGHT - PADDING}
          x2={CHART_WIDTH - PADDING}
          y2={CHART_HEIGHT - PADDING}
          stroke="#1E293B"
          strokeWidth="1"
        />
        <Line
          x1={PADDING}
          y1={PADDING}
          x2={CHART_WIDTH - PADDING}
          y2={PADDING}
          stroke="#1E293B"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Grille labels */}
        <SvgText
          x={PADDING}
          y={PADDING - 8}
          fill={Colors.textMuted}
          fontSize="10"
          fontWeight="bold"
        >
          {maxVal} {getUnit()}
        </SvgText>
        <SvgText
          x={PADDING}
          y={CHART_HEIGHT - PADDING + 16}
          fill={Colors.textMuted}
          fontSize="10"
        >
          {minVal} {getUnit()}
        </SvgText>

        {/* Surface dégradée */}
        {data.length > 1 && (
          <Path d={areaPath} fill="url(#gradientArea)" />
        )}

        {/* Ligne principale */}
        {data.length > 1 && (
          <Path
            d={linePath}
            fill="none"
            stroke={Colors.primary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points de données */}
        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill={Colors.background}
              stroke={Colors.primary}
              strokeWidth="3"
            />
          </React.Fragment>
        ))}
      </Svg>

      <View style={styles.footerDates}>
        <Text style={styles.dateLabel}>
          {new Date(data[0].date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>
        {data.length > 1 && (
          <Text style={styles.dateLabel}>
            {new Date(data[data.length - 1].date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121A28',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1F2C3F',
    marginVertical: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121A28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2C3F',
    marginVertical: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
  singlePointHint: {
    fontSize: 12,
    color: Colors.accent,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  footerDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
