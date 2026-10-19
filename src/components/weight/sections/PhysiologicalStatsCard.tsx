import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Card } from '../../common/Card';
import { WeightProgressStats } from '../../../types';
import { buildPhysiologicalProfile } from '../../../utils/physiologyUtils';

interface PhysiologicalStatsCardProps {
  stats: WeightProgressStats | null;
  userHeightCm?: number;
  weightUnit: string;
  onSetHeightPress: () => void;
  onAddLogPress: () => void;
}

export const PhysiologicalStatsCard: React.FC<PhysiologicalStatsCardProps> = ({
  stats,
  userHeightCm,
  weightUnit,
  onSetHeightPress,
  onAddLogPress,
}) => {
  const [selectedCalorieGoal, setSelectedCalorieGoal] = useState<'maintenance' | 'fatLoss' | 'leanBulk'>('maintenance');
  const [isExpanded, setIsExpanded] = useState(true);

  // Cas 1 : La taille n'est pas encore renseignée
  if (!userHeightCm || userHeightCm <= 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.missingHeightRow}>
          <View style={styles.missingHeightIconBox}>
            <Text style={{ fontSize: 22 }}>🧬</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.missingHeightTitle}>Bilan Physiologique & IMC</Text>
            <Text style={styles.missingHeightText}>
              Renseignez votre taille pour débloquer l’analyse de votre corpulence, votre métabolisme de base (BMR), votre dépense énergétique (TDEE) et votre fourchette de poids santé.
            </Text>
            <TouchableOpacity
              style={styles.setHeightBtn}
              onPress={onSetHeightPress}
              activeOpacity={0.8}
            >
              <Text style={styles.setHeightBtnText}>📏 Renseigner ma taille</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  }

  // Cas 2 : Aucune pesée enregistrée
  if (!stats?.currentWeight) {
    return (
      <Card style={styles.card}>
        <View style={styles.missingHeightRow}>
          <View style={styles.missingHeightIconBox}>
            <Text style={{ fontSize: 22 }}>⚖️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.missingHeightTitle}>Bilan Physiologique</Text>
            <Text style={styles.missingHeightText}>
              Taille enregistrée ({userHeightCm} cm). Enregistrez votre première pesée pour calculer votre IMC et vos besoins caloriques.
            </Text>
            <TouchableOpacity
              style={styles.setHeightBtn}
              onPress={onAddLogPress}
              activeOpacity={0.8}
            >
              <Text style={styles.setHeightBtnText}>+ Enregistrer ma première pesée</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  }

  const profile = buildPhysiologicalProfile(
    stats.currentWeight,
    userHeightCm,
    stats.latestBodyFat
  );

  if (!profile) return null;

  const { bmi, metabolism, ffmi } = profile;

  // Calcul du texte et valeur calorique selon le mode choisi
  const currentTargetKcal =
    selectedCalorieGoal === 'fatLoss'
      ? metabolism.targetsKcal.fatLoss
      : selectedCalorieGoal === 'leanBulk'
      ? metabolism.targetsKcal.leanBulk
      : metabolism.targetsKcal.maintenance;

  const targetLabel =
    selectedCalorieGoal === 'fatLoss'
      ? 'Déficit contrôlé (-350 kcal) pour perte de graisse sans fonte musculaire'
      : selectedCalorieGoal === 'leanBulk'
      ? 'Surplus modéré (+300 kcal) pour construction musculaire propre'
      : 'Apport de maintien pour stabiliser le poids et performer';

  return (
    <Card style={styles.card}>
      {/* En-tête de section */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Text style={{ fontSize: 20 }}>🧬</Text>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.cardTitle}>Statistiques Physiologiques</Text>
            <Text style={styles.cardSubtitle}>
              Taille : {userHeightCm} cm • Poids : {stats.currentWeight} {weightUnit}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editHeightBtn}
          onPress={onSetHeightPress}
          activeOpacity={0.7}
        >
          <Text style={styles.editHeightBtnText}>Modifier taille</Text>
        </TouchableOpacity>
      </View>

      {/* Hero IMC */}
      <View style={styles.bmiHeroContainer}>
        <View style={styles.bmiHeroTop}>
          <View>
            <Text style={styles.bmiHeroLabel}>Indice de Masse Corporelle (IMC)</Text>
            <View style={styles.bmiNumberRow}>
              <Text style={styles.bmiBigNumber}>{bmi.bmi}</Text>
              <View style={[styles.bmiCategoryBadge, { backgroundColor: `${bmi.color}20`, borderColor: bmi.color }]}>
                <Text style={[styles.bmiCategoryBadgeText, { color: bmi.color }]}>
                  {bmi.categoryLabel}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.toggleCollapseBtn}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleCollapseText}>{isExpanded ? 'Réduire ▲' : 'Détails ▼'}</Text>
          </TouchableOpacity>
        </View>

        {/* Jauge visuelle segmentée de l'IMC */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeSegment, { flex: 14, backgroundColor: '#38BDF8' }]} />
            <View style={[styles.gaugeSegment, { flex: 26, backgroundColor: '#22C55E' }]} />
            <View style={[styles.gaugeSegment, { flex: 20, backgroundColor: '#F59E0B' }]} />
            <View style={[styles.gaugeSegment, { flex: 40, backgroundColor: '#EF4444' }]} />
          </View>

          {/* Curseur de position */}
          <View style={[styles.gaugeCursorContainer, { left: `${Math.min(97, Math.max(3, bmi.gaugePercent))}%` }]}>
            <View style={[styles.gaugeCursorPin, { backgroundColor: bmi.color }]} />
            <Text style={[styles.gaugeCursorValue, { color: bmi.color }]}>▲ {bmi.bmi}</Text>
          </View>

          {/* Graduations */}
          <View style={styles.gaugeScaleLabels}>
            <Text style={styles.scaleText}>15</Text>
            <Text style={[styles.scaleText, { color: '#38BDF8' }]}>18.5</Text>
            <Text style={[styles.scaleText, { color: '#22C55E' }]}>25.0</Text>
            <Text style={[styles.scaleText, { color: '#F59E0B' }]}>30.0</Text>
            <Text style={styles.scaleText}>40</Text>
          </View>
        </View>

        <Text style={styles.healthDescriptionText}>{bmi.healthDescription}</Text>
      </View>

      {isExpanded && (
        <>
          {/* Note athlétique spécifique */}
          <View style={styles.athleticNoteCard}>
            <Text style={styles.athleticNoteText}>{bmi.athleticNote}</Text>
          </View>

          {/* Grille 2x2 Métabolisme & Repères */}
          <View style={styles.gridContainer}>
            {/* Boîte 1 : Métabolisme de Base */}
            <View style={styles.metricBox}>
              <View style={styles.metricBoxTop}>
                <Text style={{ fontSize: 16 }}>⚡</Text>
                <Text style={styles.metricBoxLabel}>Métabolisme Base (BMR)</Text>
              </View>
              <Text style={styles.metricBoxValue}>
                {metabolism.bmrKcal.toLocaleString('fr-FR')}{' '}
                <Text style={styles.metricBoxUnit}>kcal/j</Text>
              </Text>
              <Text style={styles.metricBoxSub}>Dépense vitale au repos complet</Text>
            </View>

            {/* Boîte 2 : Dépense Journalière Totale */}
            <View style={styles.metricBox}>
              <View style={styles.metricBoxTop}>
                <Text style={{ fontSize: 16 }}>🏋️‍♂️</Text>
                <Text style={styles.metricBoxLabel}>Dépense Totale (TDEE)</Text>
              </View>
              <Text style={styles.metricBoxValue}>
                {metabolism.tdeeKcal.moderateAthlete.toLocaleString('fr-FR')}{' '}
                <Text style={styles.metricBoxUnit}>kcal/j</Text>
              </Text>
              <Text style={styles.metricBoxSub}>Avec 3-4 séances/semaine</Text>
            </View>

            {/* Boîte 3 : Fourchette Poids Santé */}
            <View style={styles.metricBox}>
              <View style={styles.metricBoxTop}>
                <Text style={{ fontSize: 16 }}>🎯</Text>
                <Text style={styles.metricBoxLabel}>Poids Santé OMS</Text>
              </View>
              <Text style={styles.metricBoxValue}>
                {bmi.idealWeightMinKg} - {bmi.idealWeightMaxKg}{' '}
                <Text style={styles.metricBoxUnit}>kg</Text>
              </Text>
              <Text style={styles.metricBoxSub}>
                Médiane idéale : {bmi.idealWeightMedianKg} kg
              </Text>
            </View>

            {/* Boîte 4 : Hydratation Recommandée */}
            <View style={styles.metricBox}>
              <View style={styles.metricBoxTop}>
                <Text style={{ fontSize: 16 }}>💧</Text>
                <Text style={styles.metricBoxLabel}>Hydratation Quotidienne</Text>
              </View>
              <Text style={styles.metricBoxValue}>
                {metabolism.recommendedWaterLiters}{' '}
                <Text style={styles.metricBoxUnit}>L / jour</Text>
              </Text>
              <Text style={styles.metricBoxSub}>{"Adapté à l'effort physique"}</Text>
            </View>
          </View>

          {/* Module Cibles Caloriques par Objectif */}
          <View style={styles.targetsContainer}>
            <Text style={styles.targetsTitle}>🎯 Cibles Énergétiques selon votre Objectif</Text>

            <View style={styles.targetTabs}>
              <TouchableOpacity
                style={[
                  styles.targetTab,
                  selectedCalorieGoal === 'fatLoss' && styles.targetTabActive,
                ]}
                onPress={() => setSelectedCalorieGoal('fatLoss')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.targetTabText,
                    selectedCalorieGoal === 'fatLoss' && styles.targetTabTextActive,
                  ]}
                >
                  Sèche / Perte
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetTab,
                  selectedCalorieGoal === 'maintenance' && styles.targetTabActive,
                ]}
                onPress={() => setSelectedCalorieGoal('maintenance')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.targetTabText,
                    selectedCalorieGoal === 'maintenance' && styles.targetTabTextActive,
                  ]}
                >
                  Maintien
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetTab,
                  selectedCalorieGoal === 'leanBulk' && styles.targetTabActive,
                ]}
                onPress={() => setSelectedCalorieGoal('leanBulk')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.targetTabText,
                    selectedCalorieGoal === 'leanBulk' && styles.targetTabTextActive,
                  ]}
                >
                  Prise de masse
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.targetResultRow}>
              <View>
                <Text style={styles.targetKcalBig}>
                  {currentTargetKcal.toLocaleString('fr-FR')}{' '}
                  <Text style={{ fontSize: 16, color: Colors.primary }}>kcal / jour</Text>
                </Text>
                <Text style={styles.targetExplanationText}>{targetLabel}</Text>
              </View>
            </View>
          </View>

          {/* Section FFMI / Masse Maigre si masse grasse disponible */}
          {ffmi ? (
            <View style={styles.ffmiContainer}>
              <View style={styles.ffmiHeader}>
                <Text style={{ fontSize: 18 }}>💪</Text>
                <Text style={styles.ffmiTitle}>Indice de Masse Maigre (FFMI)</Text>
                <View style={[styles.ffmiBadge, { backgroundColor: `${ffmi.classificationColor}20`, borderColor: ffmi.classificationColor }]}>
                  <Text style={[styles.ffmiBadgeText, { color: ffmi.classificationColor }]}>
                    {ffmi.classification}
                  </Text>
                </View>
              </View>

              <View style={styles.ffmiMetricsRow}>
                <View style={styles.ffmiMetricItem}>
                  <Text style={styles.ffmiItemLabel}>FFMI ajusté</Text>
                  <Text style={[styles.ffmiItemValue, { color: ffmi.classificationColor }]}>
                    {ffmi.normalizedFfmi}
                  </Text>
                </View>
                <View style={styles.ffmiMetricItem}>
                  <Text style={styles.ffmiItemLabel}>Masse musculaire</Text>
                  <Text style={styles.ffmiItemValue}>{ffmi.leanMassKg} kg</Text>
                </View>
                <View style={styles.ffmiMetricItem}>
                  <Text style={styles.ffmiItemLabel}>Masse grasse</Text>
                  <Text style={styles.ffmiItemValue}>
                    {ffmi.fatMassKg} kg ({ffmi.bodyFatPercentage}%)
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.ffmiHintCard}>
              <Text style={{ fontSize: 16 }}>💡</Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.ffmiHintTitle}>Calculer votre masse musculaire (FFMI)</Text>
                <Text style={styles.ffmiHintText}>
                  Renseignez votre taux de masse grasse (%) lors de votre prochaine pesée pour calculer automatiquement votre FFMI et isoler votre masse musculaire maigre de votre masse grasse.
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121A28',
    borderColor: '#1E2B3E',
    marginBottom: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  editHeightBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1A2536',
    borderWidth: 1,
    borderColor: '#26374D',
  },
  editHeightBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  missingHeightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  missingHeightIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingHeightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  missingHeightText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  setHeightBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  setHeightBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
  },
  bmiHeroContainer: {
    backgroundColor: '#0A101D',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#192538',
    marginBottom: 14,
  },
  bmiHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bmiHeroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bmiNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  bmiBigNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
  },
  bmiCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  bmiCategoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toggleCollapseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleCollapseText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  gaugeContainer: {
    marginBottom: 12,
    marginTop: 4,
    position: 'relative',
    paddingTop: 8,
  },
  gaugeTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  gaugeSegment: {
    height: '100%',
  },
  gaugeCursorContainer: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -12 }],
    alignItems: 'center',
  },
  gaugeCursorPin: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 14,
  },
  gaugeCursorValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  gaugeScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  scaleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  healthDescriptionText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  athleticNoteCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    marginBottom: 14,
  },
  athleticNoteText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 17,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0A101D',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A2536',
  },
  metricBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  metricBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  metricBoxUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  metricBoxSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
  },
  targetsContainer: {
    backgroundColor: '#0A101D',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2B3E',
    marginBottom: 14,
  },
  targetsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  targetTabs: {
    flexDirection: 'row',
    backgroundColor: '#121A28',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  targetTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  targetTabActive: {
    backgroundColor: Colors.primary,
  },
  targetTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  targetTabTextActive: {
    color: '#000',
  },
  targetResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetKcalBig: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text,
  },
  targetExplanationText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  ffmiContainer: {
    backgroundColor: '#0A101D',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2B3E',
  },
  ffmiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ffmiTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  ffmiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  ffmiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ffmiMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ffmiMetricItem: {
    flex: 1,
  },
  ffmiItemLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  ffmiItemValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  ffmiHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  ffmiHintTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 2,
  },
  ffmiHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
});
