import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { Colors } from '../../constants/colors';

export const RestTimerBar: React.FC = () => {
  const { restTimer, tickRestTimer, adjustRestTimer, skipRestTimer } =
    useWorkoutSessionStore();

  useEffect(() => {
    if (!restTimer.isRunning) return;

    const interval = setInterval(() => {
      tickRestTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer.isRunning, tickRestTimer]);

  if (!restTimer.isRunning || restTimer.remainingSeconds <= 0) {
    return null;
  }

  const minutes = Math.floor(restTimer.remainingSeconds / 60);
  const seconds = restTimer.remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  const progress =
    restTimer.totalDuration > 0
      ? (restTimer.remainingSeconds / restTimer.totalDuration) * 100
      : 0;

  return (
    <View style={styles.container}>
      {/* Barre de progression */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        <View style={styles.leftInfo}>
          <Text style={styles.label}>TEMPS DE REPOS</Text>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {restTimer.exerciseName || 'Série terminée'}
          </Text>
        </View>

        <Text style={styles.timerDisplay}>{formattedTime}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.adjustBtn}
            onPress={() => adjustRestTimer(-15)}
            activeOpacity={0.7}
          >
            <Text style={styles.adjustBtnText}>-15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adjustBtn}
            onPress={() => adjustRestTimer(15)}
            activeOpacity={0.7}
          >
            <Text style={styles.adjustBtnText}>+15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={skipRestTimer}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Passer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#162235',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  leftInfo: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  timerDisplay: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginRight: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adjustBtn: {
    backgroundColor: Colors.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  adjustBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  skipBtnText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '800',
  },
});
