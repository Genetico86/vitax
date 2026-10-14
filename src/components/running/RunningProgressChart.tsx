import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { RunningSession } from '../../types';
import { Colors } from '../../constants/colors';
import { formatPace } from '../../database/runningRepository';

interface RunningProgressChartProps {
  sessions: RunningSession[];
}

type MetricType = 'pace' | 'distance' | 'duration';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 190;
const PADDING_TOP = 25;
const PADDING_BOTTOM = 35;
const PADDING_LEFT = 45;
const PADDING_RIGHT = 25;

export const RunningProgressChart: React.FC<RunningProgressChartProps> = ({ sessions }) => {
  const [metric, setMetric] = useState<MetricType>('pace');

  // Ordonner chronologiquement (de la plus ancienne à la plus récente) pour le graphique
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [sessions]);

  if (!sortedSessions || sortedSessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏃‍♂️</Text>
        <Text style={styles.emptyTitle}>Aucune course enregistrée</Text>
        <Text style={styles.emptyText}>
          Enregistrez vos premières sorties pour voir la courbe de vos temps et allures s’afficher ici !
        </Text>
      </View>
    );
  }

  // Calcul des valeurs selon la métrique
  const chartData = sortedSessions.map((s) => {
    let value = 0;
    if (metric === 'pace') {
      // Allure en minutes décimales (ex: 330s = 5.5 min)
      value = s.pace_seconds_per_km / 60;
    } else if (metric === 'distance') {
      value = s.distance_km;
    } else {
      // Durée en minutes
      value = Math.round(s.duration_seconds / 60);
    }

    const dateObj = new Date(s.date);
    const dateLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

    return {
      id: s.id,
      value,
      rawSession: s,
      dateLabel,
    };
  });

  const values = chartData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const effectiveRange = maxVal - minVal === 0 ? Math.max(1, maxVal * 0.2) : maxVal - minVal;
  const graphMin = Math.max(0, minVal - effectiveRange * 0.15);
  const graphMax = maxVal + effectiveRange * 0.15;
  const graphRange = graphMax - graphMin || 1;

  const innerWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const points = chartData.map((d, index) => {
    const x =
      chartData.length === 1
        ? PADDING_LEFT + innerWidth / 2
        : PADDING_LEFT + (index / (chartData.length - 1)) * innerWidth;

    // Pour l'allure, une valeur plus basse est meilleure -> on peut afficher normalement
    const y =
      PADDING_TOP + innerHeight - ((d.value - graphMin) / graphRange) * innerHeight;

    return { ...d, x, y };
  });

  // Construction du chemin SVG (Line & Area)
  let linePath = '';
  let areaPath = '';

  if (points.length === 1) {
    const p = points[0];
    linePath = `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`;
  } else {
    points.forEach((p, i) => {
      if (i === 0) {
        linePath += `M ${p.x} ${p.y}`;
      } else {
        // Courbe douce avec Bézier cubique
        const prev = points[i - 1];
        const cpX1 = prev.x + (p.x - prev.x) / 2;
        const cpY1 = prev.y;
        const cpX2 = prev.x + (p.x - prev.x) / 2;
        const cpY2 = p.y;
        linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
      }
    });

    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = CHART_HEIGHT - PADDING_BOTTOM;
    areaPath = `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }

  // Tendance & Différence entre la première et la dernière session
  const firstVal = chartData[0].value;
  const lastVal = chartData[chartData.length - 1].value;
  const diff = lastVal - firstVal;

  let trendText = '';
  let trendColor = Colors.primary;
  if (metric === 'pace') {
    // Pour l'allure, si diff < 0 c'est un gain de vitesse (baisse du temps par km)
    if (diff < -0.05) {
      const savedSec = Math.round(Math.abs(diff) * 60);
      trendText = `⚡ Gain de vitesse : -${savedSec}s / km`;
      trendColor = Colors.success;
    } else if (diff > 0.05) {
      const addedSec = Math.round(diff * 60);
      trendText = `📈 Allure ralentie : +${addedSec}s / km`;
      trendColor = Colors.textMuted;
    } else {
      trendText = '⚖️ Allure stable et constante';
      trendColor = Colors.accent;
    }
  } else if (metric === 'distance') {
    if (diff > 0.1) {
      trendText = `🚀 Progression distance : +${diff.toFixed(1)} km`;
      trendColor = Colors.success;
    } else {
      trendText = `🏃 Distance actuelle : ${lastVal.toFixed(1)} km`;
      trendColor = Colors.accent;
    }
  } else {
    trendText = `⏱️ Durée dernière sortie : ${Math.round(lastVal)} min`;
    trendColor = Colors.accent;
  }

  const formatYValue = (val: number) => {
    if (metric === 'pace') {
      return formatPace(val * 60).replace(' / km', '');
    }
    if (metric === 'distance') {
      return `${val.toFixed(1)}k`;
    }
    return `${Math.round(val)}m`;
  };

  return (
    <View style={styles.container}>
      {/* Sélecteur de Métrique */}
      <View style={styles.metricTabs}>
        <TouchableOpacity
          style={[styles.metricTab, metric === 'pace' && styles.metricTabActive]}
          onPress={() => setMetric('pace')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.metricTabText,
              metric === 'pace' && styles.metricTabTextActive,
            ]}
          >
            ⏱ Allure (min/km)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.metricTab, metric === 'distance' && styles.metricTabActive]}
          onPress={() => setMetric('distance')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.metricTabText,
              metric === 'distance' && styles.metricTabTextActive,
            ]}
          >
            📍 Distance (km)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.metricTab, metric === 'duration' && styles.metricTabActive]}
          onPress={() => setMetric('duration')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.metricTabText,
              metric === 'duration' && styles.metricTabTextActive,
            ]}
          >
            ⏳ Durée
          </Text>
        </TouchableOpacity>
      </View>

      {/* Résumé de tendance */}
      <View style={styles.trendRow}>
        <Text style={[styles.trendBadge, { color: trendColor }]}>{trendText}</Text>
        <Text style={styles.sessionsCountBadge}>
          {sortedSessions.length} sortie{sortedSessions.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Surface SVG du Graphique */}
      <View style={styles.chartWrapper}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="runningGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Lignes repères horizontales */}
          {[0, 0.5, 1].map((pct, idx) => {
            const y = PADDING_TOP + innerHeight * pct;
            const val = graphMax - pct * graphRange;
            return (
              <React.Fragment key={`grid-${idx}`}>
                <Line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={CHART_WIDTH - PADDING_RIGHT}
                  y2={y}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="4, 4"
                />
                <SvgText
                  x={PADDING_LEFT - 8}
                  y={y + 4}
                  fill={Colors.textMuted}
                  fontSize="10"
                  textAnchor="end"
                >
                  {formatYValue(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Remplissage de l'aire sous la courbe */}
          {areaPath ? <Path d={areaPath} fill="url(#runningGradient)" /> : null}

          {/* Ligne principale */}
          <Path
            d={linePath}
            stroke="#00E5FF"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Points et étiquettes */}
          {points.map((p, idx) => {
            const isLatest = idx === points.length - 1;
            return (
              <React.Fragment key={`pt-${p.id}-${idx}`}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={isLatest ? 6 : 4}
                  fill={isLatest ? '#FF5A1F' : '#00E5FF'}
                  stroke="#0D1117"
                  strokeWidth="2"
                />

                {/* Date en bas de l'axe X (afficher max 6 dates pour lisibilité) */}
                {(points.length <= 6 || idx % Math.ceil(points.length / 5) === 0 || isLatest) && (
                  <SvgText
                    x={p.x}
                    y={CHART_HEIGHT - 10}
                    fill={isLatest ? Colors.text : Colors.textMuted}
                    fontSize="10"
                    textAnchor="middle"
                    fontWeight={isLatest ? 'bold' : 'normal'}
                  >
                    {p.dateLabel}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginVertical: 10,
  },
  metricTabs: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  metricTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  metricTabActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#00E5FF55',
  },
  metricTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  metricTabTextActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  trendBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionsCountBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyContainer: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginVertical: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
