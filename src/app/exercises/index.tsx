import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAllExercises, deleteCustomExercise } from '../../database/exerciseRepository';
import { Exercise, MuscleGroup } from '../../types';
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUPS_INFO,
  filterExercisesByMuscleTarget,
} from '../../constants/muscles';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ExerciseIllustration } from '../../components/common/ExerciseIllustration';
import { useSettingsStore } from '../../stores/settingsStore';
import { isExerciseCompatibleWithEquipment } from '../../utils/exerciseUnits';

export default function ExercisesCatalogScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Tous');
  const [selectedPreciseMuscleId, setSelectedPreciseMuscleId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { available_equipments, filter_by_available_equipment } = useSettingsStore();

  const isEquipmentFilterRestricting = useMemo(() => {
    return (
      Boolean(filter_by_available_equipment) &&
      (available_equipments || []).length < 13
    );
  }, [filter_by_available_equipment, available_equipments]);

  const loadData = useCallback(async () => {
    try {
      const list = await getAllExercises();
      setExercises(list);
    } catch (err) {
      console.error('Erreur catalogue exercices:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSelectMuscle = (m: string) => {
    setSelectedMuscle(m);
    setSelectedPreciseMuscleId('all');
  };

  const handleDeleteCustom = (exId: string) => {
    Alert.alert(
      'Supprimer l’exercice',
      'Voulez-vous supprimer cet exercice personnalisé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomExercise(exId);
            await loadData();
          },
        },
      ]
    );
  };

  // Filtrage selon le matériel disponible coché
  const equipmentFiltered = useMemo(() => {
    if (!filter_by_available_equipment) return exercises;
    return exercises.filter((e) =>
      isExerciseCompatibleWithEquipment(e, available_equipments)
    );
  }, [exercises, filter_by_available_equipment, available_equipments]);

  const muscleFiltered = useMemo(() => {
    return filterExercisesByMuscleTarget(
      equipmentFiltered,
      selectedMuscle,
      selectedPreciseMuscleId
    );
  }, [equipmentFiltered, selectedMuscle, selectedPreciseMuscleId]);

  const filtered = useMemo(() => {
    return muscleFiltered.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.equipment_needed.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [muscleFiltered, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Raccourci vers le Ciblage Musculaire Avancé */}
      <TouchableOpacity
        style={styles.targetScreenShortcut}
        onPress={() => router.push('/programs/target-muscle')}
        activeOpacity={0.8}
      >
        <Text style={styles.targetShortcutIcon}>🎯</Text>
        <Text style={styles.targetShortcutText}>
          Cibler par Zone du Corps & Muscle Précis ❯
        </Text>
      </TouchableOpacity>

      {/* Barre de recherche */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un exercice, matériel..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Onglets Filtres Muscles */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedMuscle === 'Tous' && styles.filterChipActive,
            ]}
            onPress={() => handleSelectMuscle('Tous')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedMuscle === 'Tous' && styles.filterChipTextActive,
              ]}
            >
              Tous
            </Text>
          </TouchableOpacity>

          {MUSCLE_GROUPS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.filterChip,
                selectedMuscle === m && styles.filterChipActive,
              ]}
              onPress={() => handleSelectMuscle(m)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedMuscle === m && styles.filterChipTextActive,
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sous-filtres : Muscle Précis */}
      {selectedMuscle !== 'Tous' &&
        MUSCLE_GROUPS_INFO[selectedMuscle as MuscleGroup]?.preciseMuscles &&
        MUSCLE_GROUPS_INFO[selectedMuscle as MuscleGroup].preciseMuscles.length > 0 && (
          <View style={styles.subFiltersWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subFiltersScroll}
            >
              <TouchableOpacity
                style={[
                  styles.subFilterChip,
                  selectedPreciseMuscleId === 'all' && styles.subFilterChipActive,
                ]}
                onPress={() => setSelectedPreciseMuscleId('all')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subFilterChipText,
                    selectedPreciseMuscleId === 'all' && styles.subFilterChipTextActive,
                  ]}
                >
                  🌐 Tout ({selectedMuscle})
                </Text>
              </TouchableOpacity>

              {MUSCLE_GROUPS_INFO[selectedMuscle as MuscleGroup].preciseMuscles.map(
                (sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={[
                      styles.subFilterChip,
                      selectedPreciseMuscleId === sub.id && styles.subFilterChipActive,
                    ]}
                    onPress={() => setSelectedPreciseMuscleId(sub.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subFilterChipText,
                        selectedPreciseMuscleId === sub.id &&
                          styles.subFilterChipTextActive,
                      ]}
                    >
                      {sub.emoji} {sub.name}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        )}

      {/* Liste des exercices */}
      <ScrollView contentContainerStyle={styles.listContent}>
        {/* Bandeau d'information si le filtrage matériel est actif */}
        {isEquipmentFilterRestricting && (
          <TouchableOpacity
            style={styles.equipmentFilterBanner}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.equipmentFilterBannerLeft}>
              <Text style={styles.equipmentFilterBannerIcon}>🎛️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.equipmentFilterBannerTitle}>
                  Filtrage matériel actif ({available_equipments?.length ?? 0}/13 équipements)
                </Text>
                <Text style={styles.equipmentFilterBannerSubtitle}>
                  Seuls les exercices compatibles avec votre équipement coché sont affichés
                </Text>
              </View>
            </View>
            <Text style={styles.equipmentFilterBannerAction}>Régler ⚙️</Text>
          </TouchableOpacity>
        )}

        <View style={styles.listHeaderRow}>
          <Text style={styles.resultCountText}>
            {filtered.length} exercices trouvés
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/exercises/create')}
            style={styles.addExerciseBtn}
          >
            <Text style={styles.addExerciseBtnText}>+ Nouvel exercice</Text>
          </TouchableOpacity>
        </View>

        {filtered.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun exercice trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {isEquipmentFilterRestricting
                ? 'Aucun exercice ne correspond avec votre matériel actuellement sélectionné.'
                : 'Aucun exercice ne correspond à vos critères de recherche.'}
            </Text>
            {isEquipmentFilterRestricting && (
              <TouchableOpacity
                style={styles.emptySettingsBtn}
                onPress={() => router.push('/(tabs)/settings')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptySettingsBtnText}>
                  ⚙️ Modifier le matériel disponible
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id} style={styles.exerciseCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <ExerciseIllustration
                    exerciseId={item.id}
                    targetMuscle={item.target_muscle}
                    size={52}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <View style={styles.tagsRow}>
                      <Badge
                        label={item.target_muscle}
                        color="rgba(255, 90, 31, 0.18)"
                        textColor={Colors.primary}
                      />
                      <Badge
                        label={item.equipment_needed}
                        color="#213045"
                        textColor={Colors.textSecondary}
                        style={{ marginLeft: 6 }}
                      />
                      {item.is_custom === 1 && (
                        <Badge
                          label="Perso"
                          color="rgba(147, 51, 234, 0.2)"
                          textColor="#C084FC"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                  </View>
                </View>

                {item.is_custom === 1 && (
                  <TouchableOpacity
                    onPress={() => handleDeleteCustom(item.id)}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>

              {item.description ? (
                <Text style={styles.exerciseDesc}>{item.description}</Text>
              ) : null}
            </Card>
          ))
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
  searchBarContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  targetScreenShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  targetShortcutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  targetShortcutText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: '#141E2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  filtersWrapper: {
    paddingBottom: 4,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  subFiltersWrapper: {
    paddingBottom: 8,
    marginTop: 4,
  },
  subFiltersScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  subFilterChip: {
    backgroundColor: '#101724',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1C293D',
  },
  subFilterChipActive: {
    backgroundColor: '#1B2C47',
    borderColor: Colors.accent,
  },
  subFilterChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  subFilterChipTextActive: {
    color: Colors.accent,
    fontWeight: '800',
  },
  filterChip: {
    backgroundColor: '#141E2E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22324A',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultCountText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  addExerciseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addExerciseBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseCard: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  exerciseDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  equipmentFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  equipmentFilterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  equipmentFilterBannerIcon: {
    fontSize: 20,
  },
  equipmentFilterBannerTitle: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  equipmentFilterBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  equipmentFilterBannerAction: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptySettingsBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptySettingsBtnText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
  },
});
