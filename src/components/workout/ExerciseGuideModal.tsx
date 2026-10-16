import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { ExerciseIllustration } from '../common/ExerciseIllustration';
import { getExerciseGuide, RiskLevel } from '../../services/exerciseGuideService';

interface ExerciseGuideModalProps {
  visible: boolean;
  onClose: () => void;
  exercise?: {
    id?: string;
    name?: string;
    description?: string;
    target_muscle?: string;
    equipment_needed?: string;
  } | null;
}

function getRiskStyle(level: RiskLevel) {
  switch (level) {
    case 'Faible':
      return {
        bg: 'rgba(16, 185, 129, 0.16)',
        text: '#34D399',
        border: 'rgba(16, 185, 129, 0.4)',
        bannerBg: 'rgba(16, 185, 129, 0.08)',
        icon: '🟢',
      };
    case 'Modéré':
      return {
        bg: 'rgba(245, 158, 11, 0.18)',
        text: '#FBBF24',
        border: 'rgba(245, 158, 11, 0.45)',
        bannerBg: 'rgba(245, 158, 11, 0.08)',
        icon: '🟡',
      };
    case 'Élevé':
      return {
        bg: 'rgba(239, 68, 68, 0.20)',
        text: '#F87171',
        border: 'rgba(239, 68, 68, 0.45)',
        bannerBg: 'rgba(239, 68, 68, 0.08)',
        icon: '🟠',
      };
    case 'Très Élevé':
      return {
        bg: 'rgba(220, 38, 38, 0.28)',
        text: '#FF6B6B',
        border: 'rgba(220, 38, 38, 0.65)',
        bannerBg: 'rgba(220, 38, 38, 0.12)',
        icon: '🔴',
      };
  }
}

export const ExerciseGuideModal: React.FC<ExerciseGuideModalProps> = ({
  visible,
  onClose,
  exercise,
}) => {
  if (!exercise) return null;

  const guide = getExerciseGuide(exercise);
  const riskStyle = getRiskStyle(guide.niveauRisque);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* En-tête de la modale */}
        <View style={styles.header}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerSuperTitle}>GUIDE D’EXÉCUTION TECHNIQUE</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {guide.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Fiche récapitulative visuelle de l'exercice */}
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <ExerciseIllustration
                exerciseId={guide.id}
                targetMuscle={guide.target_muscle}
                size={70}
              />
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{guide.name}</Text>
                <View style={styles.badgeRow}>
                  <Badge
                    label={guide.target_muscle}
                    color="#203048"
                    textColor={Colors.primary}
                  />
                  <Badge
                    label={guide.equipment_needed}
                    color="#1A2638"
                    textColor={Colors.textSecondary}
                  />
                  <Badge
                    label={`Risque : ${guide.niveauRisque}`}
                    color={riskStyle.bg}
                    textColor={riskStyle.text}
                  />
                </View>
              </View>
            </View>
          </Card>

          {/* 1. OBJECTIF */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🎯</Text>
              <Text style={styles.sectionTitle}>Objectif & Recrutement</Text>
            </View>
            <View style={[styles.contentCard, styles.accentBorderLeft]}>
              <Text style={styles.contentText}>{guide.objectif}</Text>
            </View>
          </View>

          {/* 2. CHARGE ADAPTÉE POUR UNE BONNE EXÉCUTION */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>⚖️</Text>
              <Text style={styles.sectionTitle}>Charge Adaptée & Intensité</Text>
            </View>
            <View style={[styles.contentCard, styles.chargeBorderLeft]}>
              <Text style={styles.chargeSubtitle}>
                Type de charge recommandé pour une exécution parfaite :
              </Text>
              <Text style={styles.contentText}>{guide.chargeAdaptee}</Text>
            </View>
          </View>

          {/* 3. POSITION & INSTALLATION */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🧘</Text>
              <Text style={styles.sectionTitle}>Position & Installation</Text>
            </View>
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{guide.position}</Text>
            </View>
          </View>

          {/* 4. POSTURE & ALIGNEMENT */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🧍</Text>
              <Text style={styles.sectionTitle}>Posture & Alignement</Text>
            </View>
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{guide.posture}</Text>
            </View>
          </View>

          {/* 5. COMPLÉTUDE DU GESTE */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🔄</Text>
              <Text style={styles.sectionTitle}>Complétude du Geste & Amplitude</Text>
            </View>
            <View style={styles.contentCard}>
              <Text style={styles.contentText}>{guide.completude}</Text>
            </View>
          </View>

          {/* 6. MENTION RISQUE & POINTS D'ATTENTION */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>⚠️</Text>
              <Text style={[styles.sectionTitle, { color: '#FBBF24' }]}>
                Points d’Attention & Sécurité
              </Text>
            </View>

            {/* Mention Risque en bannière d'alerte spécifique */}
            <View
              style={[
                styles.riskAlertBanner,
                {
                  borderColor: riskStyle.border,
                  backgroundColor: riskStyle.bannerBg,
                },
              ]}
            >
              <View style={styles.riskAlertHeader}>
                <Text style={styles.riskAlertIcon}>{riskStyle.icon}</Text>
                <Text style={[styles.riskAlertTitle, { color: riskStyle.text }]}>
                  MENTION RISQUE ({guide.niveauRisque.toUpperCase()})
                </Text>
              </View>
              <Text style={styles.riskAlertBody}>{guide.mentionRisque}</Text>
            </View>

            {/* Liste des points d'attention et erreurs critiques */}
            <View style={[styles.contentCard, styles.warningBorderLeft]}>
              <Text style={styles.warningSubtitle}>Erreurs critiques à proscrire :</Text>
              {guide.pointsAttention.map((point, index) => (
                <View key={index} style={styles.warningItemRow}>
                  <Text style={styles.warningBullet}>•</Text>
                  <Text style={styles.warningText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Bouton de confirmation */}
          <Button
            title="C'est clair, à moi de jouer ! 💪"
            variant="primary"
            size="lg"
            onPress={onClose}
            style={styles.actionButton}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2436',
    backgroundColor: '#0D1424',
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  headerSuperTitle: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162235',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#24344E',
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#121A28',
    borderColor: '#1F2D44',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionBox: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  contentCard: {
    backgroundColor: '#121A28',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1D2A3E',
  },
  accentBorderLeft: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  chargeBorderLeft: {
    borderLeftWidth: 4,
    borderLeftColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  chargeSubtitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  riskAlertBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  riskAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  riskAlertIcon: {
    fontSize: 15,
  },
  riskAlertTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  riskAlertBody: {
    color: '#F3F4F6',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  warningBorderLeft: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  warningSubtitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  contentText: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  warningItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  warningBullet: {
    color: '#F59E0B',
    fontSize: 16,
    lineHeight: 18,
    marginRight: 8,
    fontWeight: '800',
  },
  warningText: {
    color: '#E5E7EB',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 10,
    marginBottom: 20,
  },
});
