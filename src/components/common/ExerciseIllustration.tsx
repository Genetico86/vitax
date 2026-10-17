import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg from 'react-native-svg';
import {
  detectExerciseCategory,
  getBiomechanicsMetadata,
  computeMotionFrame,
  MotionFrameState,
} from './exercise-animation/biomechanicalEngine';
import { PrecisionExerciseRenderer } from './exercise-animation/PrecisionExerciseRenderer';
import { PrecisionBiomechanicsStudioModal } from './exercise-animation/PrecisionBiomechanicsStudioModal';

// -------------------------------------------------------------
// TICKER GLOBAL PARTAGÉ (25 FPS)
// Toutes les miniatures partagent une seule boucle ultra-légère (0% surcharge)
// -------------------------------------------------------------
let globalFrame = 0;
const subscribers = new Set<(f: number) => void>();
let tickerTimer: any = null;

function subscribeToMotion(callback: (f: number) => void) {
  subscribers.add(callback);
  if (subscribers.size === 1) {
    tickerTimer = setInterval(() => {
      globalFrame = (globalFrame + 1) % 80;
      subscribers.forEach((cb) => cb(globalFrame));
    }, 40); // 25 FPS, cycle complet de 3.2s
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  };
}

export interface ExerciseIllustrationProps {
  targetMuscle?: string;
  exerciseId?: string;
  size?: number;
  interactive?: boolean;
  exerciseName?: string;
}

export const ExerciseIllustration: React.FC<ExerciseIllustrationProps> = ({
  targetMuscle = 'Pectoraux',
  exerciseId = '',
  size = 56,
  interactive = true,
  exerciseName,
}) => {
  const [frame, setFrame] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMotion((f) => setFrame(f));
    return unsubscribe;
  }, []);

  // Détection de la catégorie biomécanique experte
  const category = detectExerciseCategory(exerciseId, targetMuscle);
  const metadata = getBiomechanicsMetadata(category, exerciseName);
  const motionState: MotionFrameState = computeMotionFrame(frame);

  const theme = metadata.colorTheme;
  const radius = Math.round(size * 0.28);
  const gradPrefix = `thumb_${category}_${size}`;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: theme.bg,
            borderColor: theme.primary + '33',
          },
        ]}
        onPress={() => interactive && setModalVisible(true)}
        activeOpacity={interactive ? 0.75 : 1}
        disabled={!interactive}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <PrecisionExerciseRenderer
            category={category}
            progress={motionState.progress}
            muscleTension={motionState.muscleTension}
            showTrajectory={size >= 64}
            showAngleProtractor={false}
            colorTheme={theme}
            isLargeView={false}
            gradPrefix={gradPrefix}
          />
        </Svg>

        {/* Badge animé discret indiquant la démo biomécanique */}
        {size >= 46 && (
          <View style={styles.badge}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: theme.accent,
                  opacity: frame % 20 < 12 ? 1 : 0.4,
                },
              ]}
            />
            <Text style={styles.badgeText}>HD</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* MODAL DU STUDIO BIOMÉCANIQUE INTERACTIF */}
      {interactive && (
        <PrecisionBiomechanicsStudioModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          category={category}
          metadata={metadata}
          exerciseName={exerciseName}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 3,
  },
  badgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
});
