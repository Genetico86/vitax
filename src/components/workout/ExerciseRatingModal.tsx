import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ExerciseRating } from '../../types';
import {
  getRatingForExercise,
  saveExerciseRating,
  deleteExerciseRating,
} from '../../services/exerciseRatingService';
import { useSettingsStore } from '../../stores/settingsStore';
import { showAlert } from '../../utils/alert';

interface ExerciseRatingModalProps {
  visible: boolean;
  exercise: {
    id: string;
    name: string;
    target_muscle?: string;
  } | null;
  onClose: () => void;
  onRatingSaved?: (savedRating: ExerciseRating) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '🔴 À revoir / Problème technique',
  2: '🟠 Peut être nettement amélioré',
  3: '🟡 Correct / Conforme',
  4: '🟢 Très bon exercice',
  5: '⭐ Excellent / Parfait',
};

export const ExerciseRatingModal: React.FC<ExerciseRatingModalProps> = ({
  visible,
  exercise,
  onClose,
  onRatingSaved,
}) => {
  const currentStoreUserName = useSettingsStore((state) => state.user_name);

  const [rating, setRating] = useState<number>(5);
  const [criteriaAnimation, setCriteriaAnimation] = useState<number>(5);
  const [criteriaClarity, setCriteriaClarity] = useState<number>(5);
  const [criteriaFeeling, setCriteriaFeeling] = useState<number>(5);
  const [difficultyTag, setDifficultyTag] = useState<'too_easy' | 'perfect' | 'too_hard'>('perfect');
  const [comment, setComment] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('');
  const [existingRatingId, setExistingRatingId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Charger la note existante à l'ouverture du modal
  useEffect(() => {
    if (!visible || !exercise?.id) return;

    let isMounted = true;

    getRatingForExercise(exercise.id)
      .then((existing) => {
        if (!isMounted) return;
        setIsSuccess(false);
        if (existing) {
          setExistingRatingId(existing.id);
          setRating(existing.rating);
          setCriteriaAnimation(existing.criteria_animation || existing.rating);
          setCriteriaClarity(existing.criteria_clarity || existing.rating);
          setCriteriaFeeling(existing.criteria_feeling || existing.rating);
          setDifficultyTag(existing.difficulty_tag || 'perfect');
          setComment(existing.comment || '');
          setAuthorName(existing.user_name || currentStoreUserName || 'Athlète Vitax');
        } else {
          setExistingRatingId(null);
          setRating(5);
          setCriteriaAnimation(5);
          setCriteriaClarity(5);
          setCriteriaFeeling(5);
          setDifficultyTag('perfect');
          setComment('');
          setAuthorName(currentStoreUserName || 'Athlète Vitax');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, exercise?.id, currentStoreUserName]);

  if (!visible || !exercise) {
    return null;
  }

  const handleStarPress = (starValue: number) => {
    try {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    setRating(starValue);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const saved = await saveExerciseRating({
        id: existingRatingId || undefined,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        rating,
        criteria_animation: criteriaAnimation,
        criteria_clarity: criteriaClarity,
        criteria_feeling: criteriaFeeling,
        difficulty_tag: difficultyTag,
        comment,
        user_name: authorName || currentStoreUserName || 'Athlète Vitax',
      });

      try {
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {}

      setIsSuccess(true);
      if (onRatingSaved) {
        onRatingSaved(saved);
      }

      setTimeout(() => {
        handleCloseModal();
      }, 1100);
    } catch (err) {
      console.warn('Erreur enregistrement note:', err);
      showAlert('Erreur', 'Impossible d’enregistrer votre note pour le moment.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setLoading(true);
    setIsSuccess(false);
    onClose();
  };

  const handleDelete = () => {
    if (!existingRatingId) return;
    showAlert(
      'Supprimer mon évaluation',
      'Voulez-vous retirer votre note et votre commentaire pour cet exercice ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteExerciseRating(existingRatingId, exercise.id);
            setExistingRatingId(null);
            handleCloseModal();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseModal}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* EN-TÊTE MODAL */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerSubtitle}>ÉVALUATION & RETOUR DÉVELOPPEUR</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {exercise.name}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleCloseModal}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Chargement de l’évaluation...</Text>
            </View>
          ) : isSuccess ? (
            <View style={styles.successBox}>
              <Text style={{ fontSize: 60, marginBottom: 12 }}>🎉</Text>
              <Text style={styles.successTitle}>Merci pour votre retour !</Text>
              <Text style={styles.successSub}>
                Votre note et vos suggestions aident directement le développement de Vitax.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* BANDEAU EXPLICATIF DEV */}
              <View style={styles.devBanner}>
                <Text style={styles.devBannerIcon}>🛠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.devBannerTitle}>Aidez-nous à perfectionner l’exercice</Text>
                  <Text style={styles.devBannerText}>
                    Chaque retour permet aux développeurs d’ajuster les postures, les animations anatomiques et les conseils biomécaniques.
                  </Text>
                </View>
              </View>

              {/* SECTION 1 : NOTE GLOBALE */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Note Globale</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isSelected = starVal <= rating;
                    return (
                      <TouchableOpacity
                        key={starVal}
                        onPress={() => handleStarPress(starVal)}
                        activeOpacity={0.7}
                        style={styles.starTouch}
                        accessibilityLabel={`${starVal} étoile sur 5`}
                      >
                        <Text style={[styles.starIcon, isSelected && styles.starIconActive]}>
                          {isSelected ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.ratingDescriptor}>{RATING_LABELS[rating]}</Text>
              </Card>

              {/* SECTION 2 : CRITÈRES DÉTAILLÉS */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Critères Détaillés pour l’Équipe</Text>

                {/* Critère 1 : Animation & Rendu */}
                <View style={styles.criterionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.criterionName}>🎨 Rendu & Animation 3D</Text>
                    <Text style={styles.criterionDesc}>Clarté visuelle du mouvement</Text>
                  </View>
                  <View style={styles.miniStarsRow}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setCriteriaAnimation(val)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Text style={[styles.miniStar, val <= criteriaAnimation && styles.miniStarActive]}>
                          {val <= criteriaAnimation ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Critère 2 : Consignes & Posture */}
                <View style={styles.criterionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.criterionName}>📖 Consignes & Posture</Text>
                    <Text style={styles.criterionDesc}>Explications techniques et placement</Text>
                  </View>
                  <View style={styles.miniStarsRow}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setCriteriaClarity(val)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Text style={[styles.miniStar, val <= criteriaClarity && styles.miniStarActive]}>
                          {val <= criteriaClarity ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Critère 3 : Efficacité & Biomécanique */}
                <View style={[styles.criterionRow, { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.criterionName}>💥 Biomécanique & Sensation</Text>
                    <Text style={styles.criterionDesc}>Efficacité musculaire ressentie</Text>
                  </View>
                  <View style={styles.miniStarsRow}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <TouchableOpacity
                        key={val}
                        onPress={() => setCriteriaFeeling(val)}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Text style={[styles.miniStar, val <= criteriaFeeling && styles.miniStarActive]}>
                          {val <= criteriaFeeling ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Card>

              {/* SECTION 3 : RESSENTI DE DIFFICULTÉ */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ressenti de la difficulté</Text>
                <View style={styles.difficultyPillsRow}>
                  <TouchableOpacity
                    style={[
                      styles.difficultyPill,
                      difficultyTag === 'too_easy' && styles.difficultyPillActiveEasy,
                    ]}
                    onPress={() => setDifficultyTag('too_easy')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.difficultyPillText,
                        difficultyTag === 'too_easy' && styles.difficultyPillTextActive,
                      ]}
                    >
                      🟢 Trop facile
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.difficultyPill,
                      difficultyTag === 'perfect' && styles.difficultyPillActivePerfect,
                    ]}
                    onPress={() => setDifficultyTag('perfect')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.difficultyPillText,
                        difficultyTag === 'perfect' && styles.difficultyPillTextActive,
                      ]}
                    >
                      🟡 Bien calibré
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.difficultyPill,
                      difficultyTag === 'too_hard' && styles.difficultyPillActiveHard,
                    ]}
                    onPress={() => setDifficultyTag('too_hard')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.difficultyPillText,
                        difficultyTag === 'too_hard' && styles.difficultyPillTextActive,
                      ]}
                    >
                      🔴 Trop exigeant
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* SECTION 4 : COMMENTAIRES & SUGGESTIONS */}
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Remarques & Suggestions de développement</Text>
                <Text style={styles.sectionSubtitle}>
                  Une idée d’amélioration, un angle de vue à ajuster ou un détail anatomique manquant ?
                </Text>

                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Ex : L’animation pourrait mieux marquer le verrouillage du dos en position basse, ou suggérer une variante aux haltères..."
                  placeholderTextColor="#64748B"
                  value={comment}
                  onChangeText={setComment}
                  textAlignVertical="top"
                />

                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Votre pseudo / nom de testeur :</Text>
                  <TextInput
                    style={styles.authorInput}
                    placeholder="Votre nom"
                    placeholderTextColor="#64748B"
                    value={authorName}
                    onChangeText={setAuthorName}
                  />
                </View>
              </Card>

              {/* BOUTONS D'ACTION */}
              <View style={styles.actionButtonsBox}>
                <Button
                  title={saving ? 'Enregistrement...' : existingRatingId ? 'Mettre à jour mon évaluation' : 'Envoyer mon évaluation ⭐'}
                  variant="primary"
                  size="lg"
                  onPress={handleSave}
                  disabled={saving}
                  style={{ width: '100%', marginBottom: 10 }}
                />

                {existingRatingId && (
                  <Button
                    title="Supprimer mon avis"
                    variant="ghost"
                    size="md"
                    onPress={handleDelete}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                )}

                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={onClose}
                  style={{ width: '100%' }}
                />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
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
  successBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 320,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  devBannerIcon: {
    fontSize: 24,
  },
  devBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  devBannerText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 3,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
    lineHeight: 16,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  starTouch: {
    padding: 6,
  },
  starIcon: {
    fontSize: 38,
    color: '#475569',
  },
  starIconActive: {
    color: '#F59E0B',
  },
  ratingDescriptor: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
    marginTop: 4,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  criterionName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  criterionDesc: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  miniStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 10,
  },
  miniStar: {
    fontSize: 20,
    color: '#475569',
  },
  miniStarActive: {
    color: '#F59E0B',
  },
  difficultyPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  difficultyPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyPillActiveEasy: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  difficultyPillActivePerfect: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  difficultyPillActiveHard: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  difficultyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  difficultyPillTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  commentInput: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    minHeight: 88,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  authorInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  actionButtonsBox: {
    marginTop: 10,
    alignItems: 'center',
  },
});
