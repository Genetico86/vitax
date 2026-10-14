import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAllPrograms } from '../../database/programRepository';
import { Program } from '../../types';
import { useWorkoutSessionStore } from '../../stores/workoutSessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { isProgramCompatibleByEquipmentString } from '../../utils/exerciseUnits';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { getUserGamificationStats, LevelInfo } from '../../services/gamificationService';
import { UserLevelCard } from '../../components/stats/UserLevelCard';
import { WeightHomeWidget } from '../../components/weight/WeightHomeWidget';
import { registerTrainer, loginTrainer } from '../../services/authService';

type CategoryFilter = 'all' | 'cardio' | 'rack900' | 'split' | 'bodyweight' | 'custom';

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [pokemonStats, setPokemonStats] = useState<{
    incubatingCount: number;
    hatchedCount: number;
    closestEggRemainingXp: number | null;
  } | null>(null);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(true);

  const {
    user_name,
    setUserName,
    available_equipments,
    filter_by_available_equipment,
  } = useSettingsStore();

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setAuthError(null);

    if (passwordInput.trim()) {
      setAuthLoading(true);
      if (isLoginMode) {
        const res = await loginTrainer(trimmed, passwordInput);
        setAuthLoading(false);
        if (!res.success) {
          setAuthError(res.error || 'Identifiants incorrects');
          return;
        }
      } else {
        const res = await registerTrainer(trimmed, passwordInput);
        setAuthLoading(false);
        if (!res.success) {
          setAuthError(res.error || 'Erreur lors de la création du compte');
          return;
        }
      }
    } else {
      await setUserName(trimmed);
    }

    setNameModalVisible(false);
    setPasswordInput('');
  };

  const {
    isActive,
    programName,
    elapsedSeconds,
    startWorkoutFromProgram,
    startFreeWorkout,
  } = useWorkoutSessionStore();

  const loadData = useCallback(async () => {
    try {
      const progs = await getAllPrograms();
      setPrograms(progs);

      const gamification = await getUserGamificationStats();
      setLevelInfo(gamification.levelInfo);

      const incubating = gamification.incubatingEggs;
      let closestRemaining: number | null = null;
      if (incubating.length > 0) {
        closestRemaining = Math.min(
          ...incubating.map((e) => Math.max(0, e.required_xp - e.current_xp))
        );
      }
      setPokemonStats({
        incubatingCount: incubating.length,
        hatchedCount: gamification.hatchedPokemon.length,
        closestEggRemainingXp: closestRemaining,
      });
      setWeightRefreshKey((k) => k + 1);
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
    await startWorkoutFromProgram(programId);
    router.push('/workout/active');
  };

  const handleStartFree = () => {
    startFreeWorkout();
    router.push('/workout/active');
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s.toString().padStart(2, '0')}s`;
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

  // Filtrage selon le matériel disponible coché dans les Paramètres
  const compatiblePrograms = useMemo(() => {
    if (!filter_by_available_equipment) return programs;
    return programs.filter((p) =>
      isProgramCompatibleByEquipmentString(p, available_equipments)
    );
  }, [programs, filter_by_available_equipment, available_equipments]);

  // Indicateur si un filtrage matériel est effectivement restrictif (< 13 équipements)
  const isEquipmentFilterRestricting = useMemo(() => {
    return (
      Boolean(filter_by_available_equipment) &&
      (available_equipments || []).length < 13
    );
  }, [filter_by_available_equipment, available_equipments]);

  // Nombre de programmes cardio compatibles
  const cardioCount = useMemo(
    () =>
      compatiblePrograms.filter(
        (p) =>
          p.id.includes('cardio') ||
          p.name.toLowerCase().includes('cardio') ||
          p.name.toLowerCase().includes('endurance') ||
          p.name.toLowerCase().includes('hiit') ||
          p.name.toLowerCase().includes('tapis') ||
          p.name.toLowerCase().includes('elliptique') ||
          p.description?.toLowerCase().includes('cardio')
      ).length,
    [compatiblePrograms]
  );

  // Nombre de programmes 100% sans matériel
  const bodyweightCount = useMemo(
    () =>
      compatiblePrograms.filter(
        (p) =>
          p.id.includes('no_equipment') ||
          p.id.includes('bodyweight') ||
          p.name.toLowerCase().includes('sans matériel') ||
          p.description?.toLowerCase().includes('sans matériel') ||
          p.description?.toLowerCase().includes('sans aucun équipement')
      ).length,
    [compatiblePrograms]
  );

  // Filtrage simple et lisible par catégorie
  const filteredPrograms = useMemo(() => {
    switch (selectedCategory) {
      case 'cardio':
        return compatiblePrograms.filter(
          (p) =>
            p.id.includes('cardio') ||
            p.name.toLowerCase().includes('cardio') ||
            p.name.toLowerCase().includes('endurance') ||
            p.name.toLowerCase().includes('hiit') ||
            p.name.toLowerCase().includes('tapis') ||
            p.name.toLowerCase().includes('elliptique') ||
            p.description?.toLowerCase().includes('cardio') ||
            p.description?.toLowerCase().includes('tapis') ||
            p.description?.toLowerCase().includes('vélo') ||
            p.description?.toLowerCase().includes('velo')
        );
      case 'rack900':
        return compatiblePrograms.filter(
          (p) => p.name.includes('Rack 900') || p.id.includes('rack900')
        );
      case 'bodyweight':
        return compatiblePrograms.filter(
          (p) =>
            p.id.includes('no_equipment') ||
            p.id.includes('bodyweight') ||
            p.name.toLowerCase().includes('sans matériel') ||
            p.description?.toLowerCase().includes('sans matériel') ||
            p.description?.toLowerCase().includes('sans aucun équipement')
        );
      case 'split':
        return compatiblePrograms.filter(
          (p) =>
            p.name.includes('Push') ||
            p.name.includes('Pull') ||
            p.name.includes('Legs') ||
            p.name.includes('Haut du corps')
        );
      case 'custom':
        return compatiblePrograms.filter((p) => p.is_custom === 1);
      default:
        return compatiblePrograms;
    }
  }, [compatiblePrograms, selectedCategory]);

  return (
    <View style={styles.container}>
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
        {/* En-tête convivial */}
        <View style={styles.welcomeHeader}>
          <TouchableOpacity
            style={styles.greetingTouch}
            onPress={() => {
              setNameInput(user_name || '');
              setNameModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.greetingRow}>
              <Text style={styles.greetingText}>
                Bonjour {user_name ? user_name : 'l’athlète'} 👋
              </Text>
              <View style={styles.editNameIconBox}>
                <Text style={styles.editNameIcon}>✏️</Text>
              </View>
            </View>
            <Text style={styles.mainTitle}>Prêt à vous entraîner ?</Text>
          </TouchableOpacity>

          <View style={styles.offlineStatusPill}>
            <View style={styles.greenDot} />
            <Text style={styles.offlineStatusText}>100% Hors-ligne</Text>
          </View>
        </View>

        {/* Invitation conviviale à renseigner son prénom */}
        {!user_name && showNamePrompt && (
          <Card style={styles.namePromptCard}>
            <View style={styles.namePromptContent}>
              <View style={styles.namePromptIconBox}>
                <Text style={styles.namePromptEmoji}>👋</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.namePromptTitle}>Quel est votre prénom ?</Text>
                <Text style={styles.namePromptSub}>
                  Personnalisez Vitax pour remplacer la mention « Bonjour l’athlète ».
                </Text>
              </View>
              <TouchableOpacity
                style={styles.namePromptBtn}
                onPress={() => {
                  setNameInput('');
                  setNameModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.namePromptBtnText}>Personnaliser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.namePromptClose}
                onPress={() => setShowNamePrompt(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.namePromptCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Bannière de séance active PRIORITAIRE (si en cours) */}
        {isActive && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push('/workout/active')}
            activeOpacity={0.85}
          >
            <View style={styles.activeBannerContent}>
              <View style={styles.activeBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeBadgeText}>SÉANCE EN COURS</Text>
              </View>
              <Text style={styles.activeTitle} numberOfLines={1}>
                {programName || 'Séance libre'}
              </Text>
              <Text style={styles.activeTimer}>
                ⏱ Temps écoulé : {formatElapsed(elapsedSeconds)}
              </Text>
            </View>
            <Button
              title="Reprendre ▶"
              size="sm"
              onPress={() => router.push('/workout/active')}
              variant="primary"
            />
          </TouchableOpacity>
        )}

        {/* ======================================================== */}
        {/* SECTION 1 : HUB D'ENTRAÎNEMENT & MODES RAPIDES           */}
        {/* ======================================================== */}
        <View style={styles.launchpadSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.mainSectionTitle}>⚡ Lancer un Entraînement</Text>
              <Text style={styles.mainSectionSubtitle}>
                Modes rapides, générateur intelligent et ciblage direct
              </Text>
            </View>
          </View>

          {/* Hero Card : GÉNÉRATEUR DE SÉANCES PAR IA */}
          <TouchableOpacity
            style={styles.aiHeroCard}
            onPress={() => router.push('/workout/ai-generator')}
            activeOpacity={0.88}
          >
            <View style={styles.aiHeroContent}>
              <View style={styles.aiHeroIconBox}>
                <Text style={styles.aiHeroIcon}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.aiHeroHeaderRow}>
                  <View style={styles.aiHeroBadge}>
                    <Text style={styles.aiHeroBadgeText}>IA EXPERTE • SUR-MESURE</Text>
                  </View>
                  <Text style={styles.aiHeroHint}>100% Hors-ligne</Text>
                </View>
                <Text style={styles.aiHeroTitle}>
                  Générateur de Séances par IA
                </Text>
                <Text style={styles.aiHeroSubtitle}>
                  Séance calibrée selon vos muscles cibles, durée, niveau et matériel
                </Text>
              </View>
              <View style={styles.aiHeroArrowBox}>
                <Text style={styles.aiHeroArrow}>❯</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Grille 2x2 des 4 Modes d'Accès Rapide */}
          <View style={styles.launchGrid}>
            {/* 1. Séance Libre Immédiate (1 CLIC) */}
            <TouchableOpacity
              style={[styles.launchTile, styles.launchTileFree]}
              onPress={handleStartFree}
              activeOpacity={0.85}
            >
              <View style={styles.launchTileTop}>
                <View style={[styles.launchTileIconBox, styles.launchTileIconBoxFree]}>
                  <Text style={styles.launchTileIcon}>⚡</Text>
                </View>
                <View style={styles.launchTileBadgeFree}>
                  <Text style={styles.launchTileBadgeTextFree}>1 CLIC</Text>
                </View>
              </View>
              <Text style={styles.launchTileTitle}>Séance Libre</Text>
              <Text style={styles.launchTileSubtitle}>
                Démarrage sans programme
              </Text>
            </TouchableOpacity>

            {/* 2. Ciblage Anatomique / Muscle Précis */}
            <TouchableOpacity
              style={[styles.launchTile, styles.launchTileTarget]}
              onPress={() => router.push('/programs/target-muscle')}
              activeOpacity={0.85}
            >
              <View style={styles.launchTileTop}>
                <View style={[styles.launchTileIconBox, styles.launchTileIconBoxTarget]}>
                  <Text style={styles.launchTileIcon}>🎯</Text>
                </View>
                <Text style={styles.launchTileArrow}>❯</Text>
              </View>
              <Text style={styles.launchTileTitle}>Cibler un Muscle</Text>
              <Text style={styles.launchTileSubtitle}>
                Par faisceau anatomique
              </Text>
            </TouchableOpacity>

            {/* 3. Catalogue d'Exercices (103) */}
            <TouchableOpacity
              style={[styles.launchTile, styles.launchTileCatalog]}
              onPress={() => router.push('/exercises')}
              activeOpacity={0.85}
            >
              <View style={styles.launchTileTop}>
                <View style={[styles.launchTileIconBox, styles.launchTileIconBoxCatalog]}>
                  <Text style={styles.launchTileIcon}>📖</Text>
                </View>
                <View style={styles.launchTileBadgeCatalog}>
                  <Text style={styles.launchTileBadgeTextCatalog}>103 EXO</Text>
                </View>
              </View>
              <Text style={styles.launchTileTitle}>Catalogue</Text>
              <Text style={styles.launchTileSubtitle}>
                Guides & animations
              </Text>
            </TouchableOpacity>

            {/* 4. Créer un Programme */}
            <TouchableOpacity
              style={[styles.launchTile, styles.launchTileCreate]}
              onPress={() => router.push('/programs/create')}
              activeOpacity={0.85}
            >
              <View style={styles.launchTileTop}>
                <View style={[styles.launchTileIconBox, styles.launchTileIconBoxCreate]}>
                  <Text style={styles.launchTileIcon}>➕</Text>
                </View>
                <Text style={styles.launchTileArrow}>❯</Text>
              </View>
              <Text style={styles.launchTileTitle}>Nouveau Programme</Text>
              <Text style={styles.launchTileSubtitle}>
                Créer sa propre routine
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 2 : VOS PROGRAMMES & SÉRIES                      */}
        {/* ======================================================== */}
        <View style={styles.programsSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.mainSectionTitle}>📋 Vos Programmes & Séries</Text>
              <Text style={styles.mainSectionSubtitle}>
                {compatiblePrograms.length} programme{compatiblePrograms.length > 1 ? 's' : ''} disponible{compatiblePrograms.length > 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sectionActionBtn}
              onPress={() => router.push('/programs/create')}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionActionBtnText}>+ Créer</Text>
            </TouchableOpacity>
          </View>

          {/* Onglets Catégories simples & fluides */}
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

            {/* NOUVEAU : Série Cardio */}
            <TouchableOpacity
              style={[
                styles.categoryPill,
                selectedCategory === 'cardio' && styles.categoryPillActiveCardio,
              ]}
              onPress={() => setSelectedCategory('cardio')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === 'cardio' && styles.categoryPillTextActiveCardio,
                ]}
              >
                🏃 Série Cardio ({cardioCount})
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
                🏠 Sans Matériel ({bodyweightCount})
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
                ⭐ Mes Programmes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Bandeau interactif si le filtrage matériel est actif */}
        {isEquipmentFilterRestricting && (
          <TouchableOpacity
            style={styles.equipmentFilterBanner}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.equipmentFilterBannerLeft}>
              <View style={styles.equipmentFilterBannerIconBox}>
                <Text style={styles.equipmentFilterBannerIcon}>🎛️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.equipmentFilterBannerTitle}>
                  Filtrage matériel actif ({available_equipments?.length ?? 0}/13)
                </Text>
                <Text style={styles.equipmentFilterBannerSubtitle}>
                  {compatiblePrograms.length} programme{compatiblePrograms.length > 1 ? 's' : ''} réalisable{compatiblePrograms.length > 1 ? 's' : ''} avec vos équipements
                </Text>
              </View>
            </View>
            <Text style={styles.equipmentFilterBannerAction}>Régler ⚙️</Text>
          </TouchableOpacity>
        )}

        {/* Liste des programmes simplifiée et visuelle */}
        {filteredPrograms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun programme trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {isEquipmentFilterRestricting
                ? 'Aucun programme ne correspond à cette sélection avec vos équipements actuellement cochés.'
                : 'Vous pouvez créer votre propre programme sur mesure en quelques secondes.'}
            </Text>
            {isEquipmentFilterRestricting && (
              <Button
                title="⚙️ Modifier les équipements"
                variant="outline"
                size="sm"
                onPress={() => router.push('/(tabs)/settings')}
                style={{ marginTop: 12 }}
              />
            )}
            <Button
              title="+ Créer un programme"
              variant="primary"
              size="sm"
              onPress={() => router.push('/programs/create')}
              style={{ marginTop: 8 }}
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
              item.name.toLowerCase().includes('tapis') ||
              item.name.toLowerCase().includes('elliptique');

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

                {/* Bouton de lancement direct - 1 CLIC */}
                <View style={styles.cardBottomActions}>
                  <TouchableOpacity
                    style={styles.detailsLink}
                    onPress={() => router.push(`/programs/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailsLinkText}>Voir les exercices ❯</Text>
                  </TouchableOpacity>

                  <Button
                    title="Démarrer ▶"
                    size="md"
                    variant="primary"
                    onPress={() => handleStartProgram(item.id)}
                    style={styles.startProgramBtn}
                  />
                </View>
              </Card>
            );
          })
        )}

        {/* ======================================================== */}
        {/* SECTION 3 : ESPACE ATHLÈTE, PROGRESSION & RÉCOMPENSES     */}
        {/* ======================================================== */}
        <View style={styles.athleteSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.mainSectionTitle}>🏆 Espace Athlète & Progression</Text>
              <Text style={styles.mainSectionSubtitle}>
                Niveau XP, Pokédex, incubateurs et suivi corporel
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.arenaHeaderBtn}
                onPress={() => router.push('/arena')}
                activeOpacity={0.8}
              >
                <Text style={styles.arenaHeaderBtnText}>🏟️ Arène ❯</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.athleteHeaderBtn}
                onPress={() => router.push('/(tabs)/history')}
                activeOpacity={0.8}
              >
                <Text style={styles.athleteHeaderBtnText}>Historique ❯</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Carte Arène & Multijoueur */}
          <TouchableOpacity
            style={styles.arenaBannerCard}
            onPress={() => router.push('/arena')}
            activeOpacity={0.85}
          >
            <View style={styles.arenaBannerContent}>
              <View style={styles.arenaIconBox}>
                <Text style={{ fontSize: 24 }}>🏟️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.arenaHeaderRow}>
                  <View style={styles.arenaBadge}>
                    <Text style={styles.arenaBadgeText}>COMMUNAUTÉ & MULTI</Text>
                  </View>
                  <Text style={styles.arenaHint}>Ligues • Échanges • Raids</Text>
                </View>
                <Text style={styles.arenaTitle}>Arène Vitax & Classements</Text>
                <Text style={styles.arenaSubtitle}>
                  Participez aux ligues d’arènes, échangez des Pokémon et affrontez le Raid Boss en équipe
                </Text>
              </View>
              <Text style={styles.arenaArrow}>❯</Text>
            </View>
          </TouchableOpacity>

          {/* Carte de Niveau & Points XP */}
          {levelInfo && (
            <UserLevelCard
              levelInfo={levelInfo}
              onPress={() => router.push('/(tabs)/history?tab=achievements')}
            />
          )}

          {/* Widget Incubateurs Pokémon & Oeufs */}
          {pokemonStats && (
            <TouchableOpacity
              style={styles.pokemonWidgetCard}
              onPress={() => router.push('/(tabs)/history?tab=pokemon')}
              activeOpacity={0.85}
            >
              <View style={styles.pokemonWidgetIconBox}>
                <Text style={styles.pokemonWidgetIconEmoji}>🥚</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.pokemonWidgetTitleRow}>
                  <Text style={styles.pokemonWidgetTitle}>
                    Incubateurs & Pokédex
                  </Text>
                  <View style={styles.pokemonWidgetBadge}>
                    <Text style={styles.pokemonWidgetBadgeText}>
                      {pokemonStats.hatchedCount} Pokémon
                    </Text>
                  </View>
                </View>
                <Text style={styles.pokemonWidgetSubtitle}>
                  {pokemonStats.incubatingCount > 0
                    ? `${pokemonStats.incubatingCount} œuf(s) en incubation • Prochaine éclosion dans ${pokemonStats.closestEggRemainingXp} XP`
                    : 'Ouvrez vos incubateurs pour faire éclore des Pokémon !'}
                </Text>
              </View>
              <Text style={styles.pokemonWidgetArrow}>❯</Text>
            </TouchableOpacity>
          )}

          {/* Widget Suivi du Poids & Objectifs */}
          <WeightHomeWidget refreshTrigger={weightRefreshKey} />
        </View>
      </ScrollView>

      {/* Modal de Saisie du Prénom */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.nameModalCard}>
            <View style={styles.nameModalHeader}>
              <View style={styles.nameModalIconCircle}>
                <Text style={{ fontSize: 28 }}>🏆</Text>
              </View>
              <Text style={styles.nameModalTitle}>
                {isLoginMode ? 'Connexion Dresseur' : 'Profil & Compte Dresseur'}
              </Text>
              <Text style={styles.nameModalSubtitle}>
                {isLoginMode
                  ? 'Connectez-vous pour retrouver vos classements et vos Pokémon'
                  : 'Renseignez votre pseudo et votre mot de passe pour participer aux classements partagés.'}
              </Text>
            </View>

            {authError && (
              <View style={styles.authErrorBox}>
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            )}

            <Text style={styles.inputFieldLabel}>Nom d’utilisateur (Pseudo)</Text>
            <TextInput
              style={styles.nameModalInput}
              placeholder="Ex: Thomas, Sarah, Lucas..."
              placeholderTextColor={Colors.textMuted}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              maxLength={25}
              returnKeyType="next"
            />

            <Text style={styles.inputFieldLabel}>Mot de passe</Text>
            <TextInput
              style={styles.nameModalInput}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <View style={styles.persistentLoginNote}>
              <Text style={styles.persistentLoginNoteText}>
                🔒 Connexion permanente : vous n’aurez jamais besoin de resaisir votre mot de passe à l’ouverture de l’application.
              </Text>
            </View>

            <TouchableOpacity
              style={{ alignItems: 'center', marginBottom: 12 }}
              onPress={() => {
                setIsLoginMode((m) => !m);
                setAuthError(null);
              }}
            >
              <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>
                {isLoginMode
                  ? 'Nouveau dresseur ? Créer un compte'
                  : 'Vous avez déjà un compte ? Se connecter'}
              </Text>
            </TouchableOpacity>

            <View style={styles.nameModalActions}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setNameModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={
                  authLoading
                    ? 'Validation...'
                    : isLoginMode
                    ? 'Connexion'
                    : 'Enregistrer'
                }
                variant="primary"
                size="md"
                onPress={handleSaveName}
                disabled={authLoading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  greetingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  offlineStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131E2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F314A',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  offlineStatusText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activeBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  activeBannerContent: {
    flex: 1,
    marginRight: 10,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  activeBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  activeTimer: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  // Section Headers & Containers
  launchpadSection: {
    marginBottom: 22,
  },
  programsSection: {
    marginBottom: 16,
  },
  athleteSection: {
    marginTop: 16,
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#1A2638',
    paddingTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mainSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  mainSectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionActionBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionActionBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  athleteHeaderBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  athleteHeaderBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '800',
  },
  arenaHeaderBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  arenaHeaderBtnText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800',
  },
  arenaBannerCard: {
    backgroundColor: '#13192B',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  arenaBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  arenaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  arenaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  arenaBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  arenaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arenaHint: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '600',
  },
  arenaTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  arenaSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  arenaArrow: {
    color: '#A78BFA',
    fontSize: 16,
    fontWeight: '800',
    paddingLeft: 4,
  },

  // Hero Card IA
  aiHeroCard: {
    backgroundColor: '#121929',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  aiHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  aiHeroIcon: {
    fontSize: 24,
  },
  aiHeroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aiHeroBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiHeroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  aiHeroHint: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '600',
  },
  aiHeroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 3,
  },
  aiHeroSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  aiHeroArrowBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  aiHeroArrow: {
    color: '#A5B4FC',
    fontSize: 15,
    fontWeight: '900',
  },

  // Grille 2x2 des 4 Modes d'Accès Rapide
  launchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  launchTile: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1.5,
  },
  launchTileFree: {
    backgroundColor: '#161922',
    borderColor: 'rgba(255, 90, 31, 0.45)',
  },
  launchTileTarget: {
    backgroundColor: '#101A29',
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  launchTileCatalog: {
    backgroundColor: '#14172B',
    borderColor: 'rgba(139, 92, 246, 0.45)',
  },
  launchTileCreate: {
    backgroundColor: '#19181B',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  launchTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  launchTileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchTileIconBoxFree: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
  },
  launchTileIconBoxTarget: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  launchTileIconBoxCatalog: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  launchTileIconBoxCreate: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  launchTileIcon: {
    fontSize: 18,
  },
  launchTileBadgeFree: {
    backgroundColor: '#FF5A1F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  launchTileBadgeTextFree: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  launchTileBadgeCatalog: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  launchTileBadgeTextCatalog: {
    color: '#C4B5FD',
    fontSize: 9,
    fontWeight: '900',
  },
  launchTileArrow: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  launchTileTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  launchTileSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 14,
  },
  categoriesSection: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  categoryPills: {
    gap: 8,
    paddingBottom: 4,
  },
  categoryPill: {
    backgroundColor: '#131D2D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#202E42',
  },
  categoryPillActive: {
    backgroundColor: '#1E2D44',
    borderColor: Colors.primary,
  },
  categoryPillText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  categoryPillActiveCardio: {
    backgroundColor: '#0E3A4A',
    borderColor: '#06B6D4',
  },
  categoryPillTextActiveCardio: {
    color: '#67E8F9',
    fontWeight: '800',
  },
  categoryPillTarget: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  categoryPillTargetText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '800',
  },
  programCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
  },
  rack900CardHighlight: {
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  cardioCardHighlight: {
    borderColor: 'rgba(6, 182, 212, 0.45)',
    backgroundColor: '#0B1D28',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  exercisesCountBadge: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  programTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  programDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1A2638',
    paddingTop: 12,
  },
  detailsLink: {
    paddingVertical: 6,
  },
  detailsLinkText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  startProgramBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  pokemonWidgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pokemonWidgetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  pokemonWidgetIconEmoji: {
    fontSize: 24,
  },
  pokemonWidgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pokemonWidgetTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  pokemonWidgetBadge: {
    backgroundColor: '#78350F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pokemonWidgetBadgeText: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '800',
  },
  pokemonWidgetSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  pokemonWidgetArrow: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  greetingTouch: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editNameIconBox: {
    padding: 2,
    opacity: 0.7,
  },
  editNameIcon: {
    fontSize: 13,
  },
  namePromptCard: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#111D2D',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 14,
  },
  namePromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  namePromptIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  namePromptEmoji: {
    fontSize: 20,
  },
  namePromptTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  namePromptSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  namePromptBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8,
  },
  namePromptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  namePromptClose: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 4,
  },
  namePromptCloseText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  nameModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1A2434',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A3B54',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  nameModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  nameModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  nameModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  nameModalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  nameModalInput: {
    backgroundColor: '#0F1622',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334766',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  inputFieldLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  persistentLoginNote: {
    backgroundColor: '#111A29',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 14,
  },
  persistentLoginNoteText: {
    color: '#93C5FD',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  authErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 10,
  },
  authErrorText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginBottom: 16,
  },
  equipmentFilterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  equipmentFilterBannerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentFilterBannerIcon: {
    fontSize: 18,
  },
  equipmentFilterBannerTitle: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  equipmentFilterBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  equipmentFilterBannerAction: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
});

