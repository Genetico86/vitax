import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Colors } from '../../constants/colors';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ExerciseRating } from '../../types';
import {
  getAllUserFeedbackForDev,
  exportFeedbackSummaryText,
  exportFeedbackSummaryJson,
} from '../../services/exerciseRatingService';
import { showAlert } from '../../utils/alert';

interface DeveloperFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenRatingForExercise?: (exerciseId: string, exerciseName: string) => void;
}

type FilterType = 'all' | 'needs_improvement' | 'positive' | 'with_comment';

export const DeveloperFeedbackModal: React.FC<DeveloperFeedbackModalProps> = ({
  visible,
  onClose,
  onOpenRatingForExercise,
}) => {
  const [feedbacks, setFeedbacks] = useState<ExerciseRating[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    getAllUserFeedbackForDev()
      .then((data) => {
        if (isMounted) setFeedbacks(data);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleClose = () => {
    setLoading(true);
    setCopiedSuccess(false);
    onClose();
  };

  if (!visible) return null;

  const totalCount = feedbacks.length;
  const avgRating = totalCount > 0
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalCount).toFixed(1)
    : '0';

  const needsImprovementCount = feedbacks.filter((f) => f.rating <= 3).length;

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === 'needs_improvement') return f.rating <= 3;
    if (filter === 'positive') return f.rating >= 4;
    if (filter === 'with_comment') return Boolean(f.comment && f.comment.trim().length > 0);
    return true;
  });

  const downloadWebFile = (fileName: string, content: string, mimeType: string): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareReport = async () => {
    try {
      const reportText = await exportFeedbackSummaryText();
      const filename = `vitax_feedback_report_${Date.now()}.txt`;

      if (Platform.OS === 'web') {
        downloadWebFile(filename, reportText, 'text/plain');
        showAlert('Rapport téléchargé', 'Le rapport texte a été téléchargé avec succès.');
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2000);
        return;
      }

      const targetFile = new File(Paths.cache, filename);
      if (targetFile.exists) {
        targetFile.delete();
      }
      targetFile.create();
      targetFile.write(reportText);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetFile.uri, {
          mimeType: 'text/plain',
          dialogTitle: 'Exporter le rapport retours exercices',
        });
      } else {
        showAlert('Rapport généré', reportText.slice(0, 500) + '...');
      }
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    } catch {
      showAlert('Erreur', 'Impossible d’exporter le rapport pour le moment.');
    }
  };

  const handleExportJson = async () => {
    try {
      const jsonText = await exportFeedbackSummaryJson();
      const filename = `vitax_exercises_ratings_${Date.now()}.json`;

      if (Platform.OS === 'web') {
        downloadWebFile(filename, jsonText, 'application/json');
        showAlert('Succès', 'Le fichier JSON des avis a été téléchargé.');
        return;
      }

      const targetFile = new File(Paths.cache, filename);
      if (targetFile.exists) {
        targetFile.delete();
      }
      targetFile.create();
      targetFile.write(jsonText);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetFile.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Exporter les avis en JSON',
        });
      } else {
        showAlert('JSON généré', `${feedbacks.length} avis exportés.`);
      }
    } catch {
      showAlert('Erreur', 'Impossible d’exporter le fichier JSON.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* EN-TÊTE */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18 }}>🛠️</Text>
              <Text style={styles.headerTitle}>Retours & Notes Développeur</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Suivi des notes et suggestions pour améliorer les exercices
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Chargement des avis enregistrés...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
          >
            {/* STATISTIQUES GLOBALES */}
            <View style={styles.statsRow}>
              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text style={styles.statVal}>{totalCount}</Text>
                <Text style={styles.statLabel}>Avis enregistrés</Text>
              </Card>

              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text style={[styles.statVal, { color: '#FBBF24' }]}>
                  {totalCount > 0 ? `${avgRating} ★` : '—'}
                </Text>
                <Text style={styles.statLabel}>Note moyenne</Text>
              </Card>

              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text
                  style={[
                    styles.statVal,
                    { color: needsImprovementCount > 0 ? '#F87171' : '#34D399' },
                  ]}
                >
                  {needsImprovementCount}
                </Text>
                <Text style={styles.statLabel}>À améliorer (≤ 3★)</Text>
              </Card>
            </View>

            {/* BOUTONS D'EXPORT DEV */}
            <View style={styles.exportButtonsRow}>
              <TouchableOpacity
                style={styles.exportBtn}
                onPress={handleShareReport}
                activeOpacity={0.8}
              >
                <Text style={styles.exportBtnText}>
                  {copiedSuccess ? '✅ Rapport partagé' : '📤 Exporter Rapport Texte'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportBtn, { backgroundColor: '#1E293B' }]}
                onPress={handleExportJson}
                activeOpacity={0.8}
              >
                <Text style={styles.exportBtnText}>💾 Format JSON</Text>
              </TouchableOpacity>
            </View>

            {/* FILTRES PAR CATÉGORIE D'AVIS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
            >
              <TouchableOpacity
                style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
                  Tous ({totalCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filter === 'needs_improvement' && styles.filterChipActive,
                ]}
                onPress={() => setFilter('needs_improvement')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === 'needs_improvement' && styles.filterChipTextActive,
                  ]}
                >
                  ⚠️ À améliorer ({needsImprovementCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, filter === 'with_comment' && styles.filterChipActive]}
                onPress={() => setFilter('with_comment')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === 'with_comment' && styles.filterChipTextActive,
                  ]}
                >
                  💬 Avec commentaire
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, filter === 'positive' && styles.filterChipActive]}
                onPress={() => setFilter('positive')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === 'positive' && styles.filterChipTextActive,
                  ]}
                >
                  ⭐ Positifs (≥ 4★)
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* LISTE DES RETOURS DÉVELOPPEUR */}
            {filteredFeedbacks.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
                <Text style={styles.emptyTitle}>Aucun retour dans cette catégorie</Text>
                <Text style={styles.emptySubtitle}>
                  {totalCount === 0
                    ? 'Aucun avis utilisateur n’a encore été soumis. Notez un exercice depuis le catalogue pour tester le système !'
                    : 'Modifiez le filtre ci-dessus pour consulter les autres avis.'}
                </Text>
              </Card>
            ) : (
              filteredFeedbacks.map((item) => (
                <Card key={item.id} style={styles.feedbackCard}>
                  {/* EN-TÊTE DE LA CARTE */}
                  <View style={styles.feedbackHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedbackExName}>
                        {item.exercise_name || item.exercise_id}
                      </Text>
                      <Text style={styles.feedbackAuthor}>
                        Par {item.user_name || 'Athlète'} • {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>

                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingBadgeStars}>{'★'.repeat(item.rating)}</Text>
                      <Text style={styles.ratingBadgeVal}>{item.rating}/5</Text>
                    </View>
                  </View>

                  {/* CRITÈRES DÉTAILLÉS */}
                  <View style={styles.criteriaRow}>
                    {item.criteria_animation ? (
                      <Badge
                        label={`🎨 Rendu ${item.criteria_animation}/5`}
                        color="rgba(56, 189, 248, 0.15)"
                        textColor="#38BDF8"
                      />
                    ) : null}
                    {item.criteria_clarity ? (
                      <Badge
                        label={`📖 Clarté ${item.criteria_clarity}/5`}
                        color="rgba(168, 85, 247, 0.15)"
                        textColor="#C084FC"
                        style={{ marginLeft: 6 }}
                      />
                    ) : null}
                    {item.criteria_feeling ? (
                      <Badge
                        label={`💥 Sensation ${item.criteria_feeling}/5`}
                        color="rgba(34, 197, 94, 0.15)"
                        textColor="#4ADE80"
                        style={{ marginLeft: 6 }}
                      />
                    ) : null}
                  </View>

                  {/* COMMENTAIRE DEV */}
                  {item.comment ? (
                    <View style={styles.commentBox}>
                      <Text style={styles.commentLabel}>💬 Note pour l’équipe :</Text>
                      <Text style={styles.commentText}>« {item.comment} »</Text>
                    </View>
                  ) : null}

                  {/* ACTION : MODIFIER OU COMPLÉTER */}
                  {onOpenRatingForExercise && (
                    <TouchableOpacity
                      style={styles.editRatingMiniBtn}
                      onPress={() => onOpenRatingForExercise(item.exercise_id, item.exercise_name || item.exercise_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editRatingMiniBtnText}>✏️ Ajuster l’évaluation</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              ))
            )}
          </ScrollView>
        )}

        {/* PIED DE PAGE */}
        <View style={styles.footer}>
          <Button
            title="Fermer"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ width: '100%' }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: {
    color: '#38BDF8',
    fontSize: 12.5,
    fontWeight: '800',
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterScrollContent: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  feedbackCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feedbackExName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  feedbackAuthor: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingBadgeStars: {
    color: '#FBBF24',
    fontSize: 12,
  },
  ratingBadgeVal: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  commentBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 12.5,
    color: '#E2E8F0',
    lineHeight: 17,
  },
  editRatingMiniBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editRatingMiniBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
});
