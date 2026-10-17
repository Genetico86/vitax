import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Svg from 'react-native-svg';
import { Colors } from '../../../constants/colors';
import {
  ExerciseBiomechanicCategory,
  BiomechanicsMetadata,
  computeMotionFrame,
  MotionFrameState,
} from './biomechanicalEngine';
import { PrecisionExerciseRenderer } from './PrecisionExerciseRenderer';

interface PrecisionBiomechanicsStudioModalProps {
  visible: boolean;
  onClose: () => void;
  category: ExerciseBiomechanicCategory;
  metadata: BiomechanicsMetadata;
  exerciseName?: string;
}

export const PrecisionBiomechanicsStudioModal: React.FC<
  PrecisionBiomechanicsStudioModalProps
> = ({ visible, onClose, category, metadata, exerciseName }) => {
  // Contrôles du lecteur
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSlowMotion, setIsSlowMotion] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  // Moteur d'animation local au studio
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (selectedStep !== null) {
      // Si un pas fixe est sélectionné, on fige sur la frame correspondante
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = isSlowMotion ? 80 : 40; // 40ms = 25fps (vitesse normale), 80ms = 12.5fps (slow motion 0.5x)
    timerRef.current = setInterval(() => {
      setFrame((prev) => (prev + 1) % 80);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, isPlaying, isSlowMotion, selectedStep]);

  // Frame effective calculée
  const activeFrame =
    selectedStep === 1
      ? 0 // Position de départ / installation
      : selectedStep === 2
      ? 48 // Point bas / étirement maximal
      : selectedStep === 3
      ? 68 // Contraction maximale / poussée
      : frame;

  const motionState: MotionFrameState = computeMotionFrame(activeFrame);

  // Sélecteur de pas fixe
  const handleSelectStep = (stepNumber: number) => {
    if (selectedStep === stepNumber) {
      // Reprise de la lecture fluide
      setSelectedStep(null);
      setIsPlaying(true);
    } else {
      setSelectedStep(stepNumber);
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = () => {
    if (selectedStep !== null) {
      setSelectedStep(null);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const theme = metadata.colorTheme;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* EN-TÊTE DU STUDIO BIOMÉCANIQUE */}
          <View style={styles.header}>
            <View style={styles.headerTitleBox}>
              <View style={styles.headerBadgeRow}>
                <View style={[styles.proBadge, { backgroundColor: theme.primary + '25' }]}>
                  <Text style={[styles.proBadgeText, { color: theme.primary }]}>
                    STUDIO BIOMÉCANIQUE 360°
                  </Text>
                </View>
                <View style={styles.fpsBadge}>
                  <Text style={styles.fpsText}>
                    {isSlowMotion ? 'RALENTI 0.5x' : 'TEMPO 1.0x'}
                  </Text>
                </View>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {exerciseName || metadata.title}
              </Text>
              <Text style={styles.subtitle}>
                {metadata.targetMuscleGroup} • {metadata.primaryMuscles.join(', ')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* GRAND LECTEUR VECTORIEL HAUTE DÉFINITION */}
            <View style={[styles.playerContainer, { backgroundColor: theme.bg }]}>
              {/* Overlay Trajectoire laser & angle */}
              <View style={styles.playerTopBar}>
                <View style={styles.anglePill}>
                  <Text style={styles.anglePillIcon}>📐</Text>
                  <Text style={styles.anglePillText}>
                    {metadata.jointAngleInfo.targetAngle}
                  </Text>
                </View>

                <View style={styles.tensionMeter}>
                  <Text style={styles.tensionLabel}>Tension :</Text>
                  <View style={styles.tensionTrack}>
                    <View
                      style={[
                        styles.tensionFill,
                        {
                          width: `${Math.round(motionState.muscleTension * 100)}%`,
                          backgroundColor: theme.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.tensionValue, { color: theme.accent }]}>
                    {Math.round(motionState.muscleTension * 100)}%
                  </Text>
                </View>
              </View>

              {/* Rendu SVG Haute Précision */}
              <View style={styles.svgViewport}>
                <Svg width={250} height={210} viewBox="0 0 100 100">
                  <PrecisionExerciseRenderer
                    category={category}
                    progress={motionState.progress}
                    muscleTension={motionState.muscleTension}
                    showTrajectory={showTrajectory}
                    showAngleProtractor={showAngles}
                    colorTheme={theme}
                    isLargeView={true}
                    gradPrefix="studio_modal"
                  />
                </Svg>
              </View>

              {/* HUD EN DIRECT : PHASE DU GESTE & TEMPO */}
              <View style={styles.phaseIndicatorBar}>
                <Text style={styles.phaseEmoji}>{motionState.phaseIcon}</Text>
                <Text style={styles.phaseTitle}>{motionState.phaseLabel}</Text>
              </View>

              {/* GUIDE RESPIRATOIRE SYNCHRONISÉ */}
              <View style={styles.breathingPill}>
                <Text style={styles.breathingEmoji}>{motionState.breathingIcon}</Text>
                <Text style={styles.breathingText}>{motionState.breathingText}</Text>
              </View>
            </View>

            {/* BARRE DE PROGRESSION DU TEMPO (4 PHASES) */}
            <View style={styles.tempoTrack}>
              <View
                style={[
                  styles.tempoSegment,
                  {
                    flex: 45,
                    backgroundColor:
                      motionState.phase === 'eccentric' ? theme.primary : '#1E293B',
                  },
                ]}
              >
                <Text style={styles.tempoSegText}>Descente (2-3s)</Text>
              </View>
              <View
                style={[
                  styles.tempoSegment,
                  {
                    flex: 10,
                    backgroundColor:
                      motionState.phase === 'isometric' ? '#F59E0B' : '#1E293B',
                  },
                ]}
              >
                <Text style={styles.tempoSegText}>Pause</Text>
              </View>
              <View
                style={[
                  styles.tempoSegment,
                  {
                    flex: 18,
                    backgroundColor:
                      motionState.phase === 'concentric' ? '#10B981' : '#1E293B',
                  },
                ]}
              >
                <Text style={styles.tempoSegText}>Poussée (1s)</Text>
              </View>
              <View
                style={[
                  styles.tempoSegment,
                  {
                    flex: 7,
                    backgroundColor:
                      motionState.phase === 'lockout' ? '#06B6D4' : '#1E293B',
                  },
                ]}
              >
                <Text style={styles.tempoSegText}>Lock</Text>
              </View>
            </View>

            {/* CONTRÔLES INTERACTIFS DU LECTEUR */}
            <View style={styles.controlsRow}>
              {/* Play / Pause */}
              <TouchableOpacity
                style={[
                  styles.ctrlBtn,
                  isPlaying && selectedStep === null && styles.ctrlBtnActive,
                ]}
                onPress={handleTogglePlay}
                activeOpacity={0.7}
              >
                <Text style={styles.ctrlBtnIcon}>
                  {isPlaying && selectedStep === null ? '⏸️' : '▶️'}
                </Text>
                <Text style={styles.ctrlBtnText}>
                  {isPlaying && selectedStep === null ? 'Pause' : 'Lire'}
                </Text>
              </TouchableOpacity>

              {/* Vitesse : Normal vs Ralenti */}
              <TouchableOpacity
                style={[styles.ctrlBtn, isSlowMotion && styles.ctrlBtnHighlight]}
                onPress={() => setIsSlowMotion((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.ctrlBtnIcon}>⏱️</Text>
                <Text style={styles.ctrlBtnText}>
                  {isSlowMotion ? '0.5x Ralenti' : '1.0x Normal'}
                </Text>
              </TouchableOpacity>

              {/* Trajectoire Toggle */}
              <TouchableOpacity
                style={[styles.ctrlBtn, showTrajectory && styles.ctrlBtnOutline]}
                onPress={() => setShowTrajectory((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.ctrlBtnIcon}>🎯</Text>
                <Text style={styles.ctrlBtnText}>Trajectoire</Text>
              </TouchableOpacity>

              {/* Angles Toggle */}
              <TouchableOpacity
                style={[styles.ctrlBtn, showAngles && styles.ctrlBtnOutline]}
                onPress={() => setShowAngles((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.ctrlBtnIcon}>📐</Text>
                <Text style={styles.ctrlBtnText}>Angles</Text>
              </TouchableOpacity>
            </View>

            {/* DÉCOMPOSITION PAS À PAS DU MOUVEMENT */}
            <View style={styles.stepSection}>
              <Text style={styles.sectionHeaderTitle}>
                DÉCOMPOSITION DU GESTE EN 3 ÉTAPES CLÉS
              </Text>
              <View style={styles.stepsRow}>
                <TouchableOpacity
                  style={[
                    styles.stepPill,
                    selectedStep === 1 && {
                      borderColor: theme.accent,
                      backgroundColor: theme.accent + '25',
                    },
                  ]}
                  onPress={() => handleSelectStep(1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepPillNumber}>1</Text>
                  <Text style={styles.stepPillLabel}>Départ & Gainage</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stepPill,
                    selectedStep === 2 && {
                      borderColor: theme.accent,
                      backgroundColor: theme.accent + '25',
                    },
                  ]}
                  onPress={() => handleSelectStep(2)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepPillNumber}>2</Text>
                  <Text style={styles.stepPillLabel}>Étirement Maximal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stepPill,
                    selectedStep === 3 && {
                      borderColor: theme.accent,
                      backgroundColor: theme.accent + '25',
                    },
                  ]}
                  onPress={() => handleSelectStep(3)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepPillNumber}>3</Text>
                  <Text style={styles.stepPillLabel}>Contraction Pic</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* CHECKPOINTS BIOMÉCANIQUES DE SÉCURITÉ */}
            <View style={styles.checkpointsSection}>
              <Text style={styles.sectionHeaderTitle}>
                CHECKPOINTS TECHNIQUES DU GESTE PARFAIT
              </Text>
              {metadata.checkpoints.map((cp, idx) => (
                <View key={idx} style={styles.checkpointCard}>
                  <Text style={styles.checkpointIcon}>{cp.icon}</Text>
                  <View style={styles.checkpointTextBox}>
                    <Text style={styles.checkpointTitle}>{cp.title}</Text>
                    <Text style={styles.checkpointDetail}>{cp.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* BOUTON FERMER LE STUDIO */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>C’est clair, à moi de jouer ! 💪</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: '#0A0F1D',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2436',
    backgroundColor: '#0D1424',
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  fpsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fpsText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  playerContainer: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  playerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  anglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  anglePillIcon: {
    fontSize: 10,
  },
  anglePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  tensionMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  tensionLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
  },
  tensionTrack: {
    width: 44,
    height: 5,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tensionFill: {
    height: '100%',
    borderRadius: 3,
  },
  tensionValue: {
    fontSize: 9,
    fontWeight: '900',
  },
  svgViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  phaseIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
    gap: 6,
  },
  phaseEmoji: {
    fontSize: 13,
  },
  phaseTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  breathingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  breathingEmoji: {
    fontSize: 12,
  },
  breathingText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  tempoTrack: {
    flexDirection: 'row',
    height: 18,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 14,
    gap: 2,
  },
  tempoSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tempoSegText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ctrlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131D2E',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2C42',
    gap: 6,
  },
  ctrlBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  ctrlBtnHighlight: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  ctrlBtnOutline: {
    borderColor: '#38BDF8',
  },
  ctrlBtnIcon: {
    fontSize: 12,
  },
  ctrlBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
  stepSection: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepPill: {
    flex: 1,
    backgroundColor: '#131D2E',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C42',
  },
  stepPillNumber: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  stepPillLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  checkpointsSection: {
    marginBottom: 10,
  },
  checkpointCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#121A28',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2D44',
    marginBottom: 8,
    gap: 10,
  },
  checkpointIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  checkpointTextBox: {
    flex: 1,
  },
  checkpointTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  checkpointDetail: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1A2436',
    backgroundColor: '#0D1424',
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
