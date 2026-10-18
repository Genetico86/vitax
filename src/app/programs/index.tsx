import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllPrograms } from '../../database/programRepository';
import { Program } from '../../types';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { isProgramCompatibleByEquipmentString } from '../../utils/exerciseUnits';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { showAlert } from '../../utils/alert';

type CategoryFilter = 'all' | 'cardio' | 'rack900' | 'split' | 'bodyweight' | 'custom';

export default function ProgramsListScreen() {
  const insets = useSafeAreaInsets();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { available_equipments, filter_by_available_equipment } = useSettingsStore();
  const { isActive, programName, startWorkoutFromProgram } = useWorkoutSessionStore();

  const loadData = useCallback(async () => {
    try {
      const progs = await getAllPrograms();
      setPrograms(progs);
    } catch (err) {
      console.error('Erreur chargement programmes:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartProgram = async (programId: string) => {
    if (isActive) {
      showAlert(
        'Séance déjà en cours ⚡',
        `La séance « ${programName || 'Séance libre'} » est actuellement en cours. Voulez-vous la remplacer par ce programme ?`,
        [
          {
            text: 'Reprendre en cours',
            style: 'cancel',
            onPress: () => router.push('/workout/active'),
          },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: async () => {
              await startWorkoutFromProgram(programId);
              router.push('/workout/active');
            },
          },
        ]
      );
      return;
    }
    await startWorkoutFromProgram(programId);
    router.push('/workout/active');
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Débutant':
        return Colors.success;
      case 'Intermédiaire':
        return Colors.accent;
      case 'Avancé':
        return Colors.primary;
      default:
        return Colors.buttonGray;
    }
  };

  // Filtrage selon le matériel disponible
  const compatiblePrograms = useMemo(() => {
    if (!filter_by_available_equipment) return programs;
    return programs.filter((p) =>
      isProgramCompatibleByEquipmentString(p, available_equipments)
    );
  }, [programs, filter_by_available_equipment, available_equipments]);

  // Filtrage catégorie & recherche
  const filteredPrograms = useMemo(() => {
    let list = compatiblePrograms;

    if (selectedCategory === 'cardio') {
      list = list.filter(
        (p) =>
          p.id.includes('cardio') ||
          p.name.toLowerCase().includes('cardio') ||
          p.name.toLowerCase().includes('endurance') ||
          p.name.toLowerCase().includes('tapis') ||
          p.name.toLowerCase().includes('elliptique') ||
          p.description?.toLowerCase().includes('cardio')
      );
    } else if (selectedCategory === 'rack900') {
      list = list.filter((p) => p.name.includes('Rack 900') || p.id.includes('rack900'));
    } else if (selectedCategory === 'bodyweight') {
      list = list.filter(
        (p) =>
          p.id.includes('no_equipment') ||
          p.id.includes('bodyweight') ||
          p.name.toLowerCase().includes('sans matériel') ||
          p.description?.toLowerCase().includes('sans matériel')
      );
    } else if (selectedCategory === 'split') {
      list = list.filter(
        (p) =>
          p.name.includes('Push') ||
          p.name.includes('Pull') ||
          p.name.includes('Legs') ||
          p.name.includes('Haut du corps')
      );
    } else if (selectedCategory === 'custom') {
      list = list.filter((p) => p.is_custom === 1);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [compatiblePrograms, selectedCategory, searchQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* En-tête */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>❮</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mes Programmes & Séries</Text>
          <Text style={styles.headerSubtitle}>
            {compatiblePrograms.length} programme{compatiblePrograms.length > 1 ? 's' : ''} disponible{compatiblePrograms.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/programs/create')}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Créer</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchBarWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un programme, split, muscle..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearchIcon}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Onglets Catégories */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPills}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'all' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'all' && styles.categoryPillTextActive,
              ]}
            >
              Tous ({programs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'cardio' && styles.categoryPillActiveCardio,
            ]}
            onPress={() => setSelectedCategory('cardio')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'cardio' && styles.categoryPillTextActiveCardio,
              ]}
            >
              🏃 Cardio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'rack900' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('rack900')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'rack900' && styles.categoryPillTextActive,
              ]}
            >
              🏋️ Rack 900 & Poulies
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'split' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('split')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'split' && styles.categoryPillTextActive,
              ]}
            >
              💥 Split & Banc
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'bodyweight' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('bodyweight')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'bodyweight' && styles.categoryPillTextActive,
              ]}
            >
              🏠 Sans Matériel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'custom' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('custom')}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'custom' && styles.categoryPillTextActive,
              ]}
            >
              ⭐ Mes Créations
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {filteredPrograms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun programme trouvé</Text>
            <Text style={styles.emptySubtitle}>
              Aucun entraînement ne correspond à vos filtres actuels.
            </Text>
            <Button
              title="+ Créer un programme sur mesure"
              variant="primary"
              size="sm"
              onPress={() => router.push('/programs/create')}
              style={{ marginTop: 14 }}
            />
          </Card>
        ) : (
          filteredPrograms.map((item) => {
            const diffColor = getDifficultyColor(item.difficulty_level);
            const isRack900 = item.name.includes('Rack 900') || item.id.includes('rack900');
            const isCardio =
              item.id.includes('cardio') ||
              item.name.toLowerCase().includes('cardio') ||
              item.name.toLowerCase().includes('endurance') ||
              item.name.toLowerCase().includes('tapis');

            return (
              <Card
                key={item.id}
                style={[
                  styles.programCard,
                  isRack900 && styles.rack900CardHighlight,
                  isCardio && styles.cardioCardHighlight,
                ]}
                onPress={() => router.push(`/programs/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.badgesRow}>
                    <Badge
                      label={item.difficulty_level}
                      color={`${diffColor}22`}
                      textColor={diffColor}
                    />
                    <Text style={styles.exercisesCountBadge}>
                      {item.exercises_count ?? 0} exercices
                    </Text>
                    {isCardio && (
                      <Badge
                        label="🏃 Série Cardio"
                        color="rgba(6, 182, 212, 0.2)"
                        textColor="#22D3EE"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                    {isRack900 && (
                      <Badge
                        label="Poulie Haute/Basse"
                        color="rgba(249, 115, 22, 0.2)"
                        textColor="#FB923C"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>
                </View>

                <Text style={styles.programTitle}>{item.name}</Text>
                <Text style={styles.programDescription} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.cardBottomActions}>
                  <TouchableOpacity
                    style={styles.detailsLink}
                    onPress={() => router.push(`/programs/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailsLinkText}>Détails ❯</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={styles.challengeProgramBtn}
                      onPress={() => {
                        router.push({
                          pathname: '/arena',
                          params: {
                            openChallenge: '1',
                            challengeType: 'program',
                            programId: item.id,
                          },
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.challengeProgramBtnText}>⚔️ Défier</Text>
                    </TouchableOpacity>

                    <Button
                      title="Démarrer ▶"
                      size="sm"
                      variant="primary"
                      onPress={() => handleStartProgram(item.id)}
                      style={styles.startProgramBtn}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: '#090E1A',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: Colors.text,
    fontSize: 13,
  },
  clearSearchIcon: {
    fontSize: 14,
    color: Colors.textMuted,
    padding: 6,
  },
  categoriesContainer: {
    marginVertical: 10,
  },
  categoryPills: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillActiveCardio: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  categoryPillTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  categoryPillTextActiveCardio: {
    color: '#0D1117',
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  programCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  rack900CardHighlight: {
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  cardioCardHighlight: {
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  cardTop: {
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  exercisesCountBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  programTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  programDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  detailsLink: {
    paddingVertical: 6,
  },
  detailsLinkText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  startProgramBtn: {
    minWidth: 100,
  },
  challengeProgramBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeProgramBtnText: {
    color: '#FF7A45',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
