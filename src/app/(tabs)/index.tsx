import React, { useCallback, useState } from 'react';
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
import { Colors } from '../../constants/colors';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  getUserGamificationStats,
  LevelInfo,
  POKEMON_BADGE_TIERS,
} from '../../services/gamificationService';
import { WeightHomeWidget } from '../../components/weight/WeightHomeWidget';
import { registerTrainer, loginTrainer } from '../../services/authService';

export default function HomeScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [pokemonStats, setPokemonStats] = useState<{
    incubatingCount: number;
    hatchedCount: number;
    closestEggRemainingXp: number | null;
  } | null>(null);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Profil / Nom d'utilisateur
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Modal Badges & Pokémon Hub
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  const { user_name, setUserName } = useSettingsStore();

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
      console.error('Erreur chargement accueil:', err);
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

  const handleStartFree = () => {
    startFreeWorkout();
    router.push('/workout/active');
  };

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s.toString().padStart(2, '0')}s`;
  };

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
        {/* ======================================================== */}
        {/* 1. TOUT EN HAUT : JAUGE D'EXPÉRIENCE, NIVEAU & BADGE      */}
        {/* ======================================================== */}
        <Card style={styles.topXpCard}>
          <View style={styles.topUserHeader}>
            <TouchableOpacity
              style={styles.userNameTouch}
              onPress={() => {
                setNameInput(user_name || '');
                setNameModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.userGreetingRow}>
                <Text style={styles.userGreetingText}>
                  Bonjour {user_name ? user_name : 'l’athlète'} 👋
                </Text>
                <View style={styles.editNameIconBox}>
                  <Text style={styles.editNameIcon}>✏️</Text>
                </View>
              </View>
              <Text style={styles.userSubText}>
                {levelInfo?.title || 'Dresseur Débutant'}
              </Text>
            </TouchableOpacity>

            <View style={styles.offlineStatusPill}>
              <View style={styles.greenDot} />
              <Text style={styles.offlineStatusText}>100% Hors-ligne</Text>
            </View>
          </View>

          {/* Jauge d'XP avec le Badge situé tout en haut en bout de jauge */}
          <View style={styles.xpGaugeRow}>
            {/* Niveau de l'athlète à gauche */}
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>
                Niv. {levelInfo?.level || 1}
              </Text>
            </View>

            {/* Jauge de progression au centre */}
            <View style={styles.xpTrackContainer}>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(6, levelInfo?.progressPercent ?? 0)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpNumbersText}>
                  {levelInfo?.currentXp || 0} / {levelInfo?.nextLevelXp || 500} XP
                </Text>
                <Text style={styles.xpPercentText}>
                  {levelInfo?.progressPercent || 0}%
                </Text>
              </View>
            </View>

            {/* LE BADGE : En bout de jauge, ouvre badges & pokémons */}
            <TouchableOpacity
              style={styles.endBadgeButton}
              onPress={() => setBadgeModalVisible(true)}
              activeOpacity={0.75}
              accessibilityLabel="Ouvrir les Badges et gestion des Pokémon"
            >
              <Text style={styles.endBadgeEmoji}>
                {levelInfo?.badgeEmoji || '🏅'}
              </Text>
              <View style={styles.endBadgeNotificationDot}>
                <Text style={styles.endBadgeSparkle}>✨</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Card>

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
        {/* 2. LES GRANDS BOUTONS STRUCTURANTS                        */}
        {/* ======================================================== */}

        {/* BOUTON : MES PROGRAMMES (ouvre la page dédiée) */}
        <TouchableOpacity
          style={styles.primaryActionCard}
          onPress={() => router.push('/programs')}
          activeOpacity={0.85}
        >
          <View style={styles.primaryActionIconBox}>
            <Text style={{ fontSize: 28 }}>📂</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.primaryActionHeaderRow}>
              <Text style={styles.primaryActionTitle}>Mes Programmes</Text>
              <Badge
                label={`${programs.length} dispo`}
                color="rgba(255, 90, 31, 0.2)"
                textColor={Colors.primary}
              />
            </View>
            <Text style={styles.primaryActionSubtitle}>
              Split, Rack 900, Sans Matériel, Cardio & Programmes sur mesure
            </Text>
          </View>
          <Text style={styles.primaryActionArrow}>❯</Text>
        </TouchableOpacity>

        {/* BOUTON : MULTIJOUEUR / SOCIAL */}
        <TouchableOpacity
          style={[styles.primaryActionCard, styles.multiplayerCardHighlight]}
          onPress={() => router.push('/arena')}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.primaryActionIconBox,
              styles.multiplayerIconHighlight,
            ]}
          >
            <Text style={{ fontSize: 28 }}>⚔️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.primaryActionHeaderRow}>
              <Text style={styles.primaryActionTitle}>Multijoueur / Social</Text>
              <Badge
                label="Arène Vitax"
                color="rgba(168, 85, 247, 0.25)"
                textColor="#C084FC"
              />
            </View>
            <Text style={styles.primaryActionSubtitle}>
              Classement général & amis, échanges de Pokémon, invitations et Raids Co-op
            </Text>
          </View>
          <Text style={styles.primaryActionArrow}>❯</Text>
        </TouchableOpacity>

        {/* BOUTON : COURSE À PIED & ENDURANCE */}
        <TouchableOpacity
          style={[styles.primaryActionCard, styles.runningCardHighlight]}
          onPress={() => router.push('/running')}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.primaryActionIconBox,
              styles.runningIconHighlight,
            ]}
          >
            <Text style={{ fontSize: 28 }}>🏃‍♂️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.primaryActionHeaderRow}>
              <Text style={styles.primaryActionTitle}>Course à Pied</Text>
              <Badge
                label="Chrono & Graph"
                color="rgba(0, 229, 255, 0.2)"
                textColor="#00E5FF"
              />
            </View>
            <Text style={styles.primaryActionSubtitle}>
              Quantification temps & km, allure moyenne et courbe de performance
            </Text>
          </View>
          <Text style={styles.primaryActionArrow}>❯</Text>
        </TouchableOpacity>

        {/* ======================================================== */}
        {/* 3. MODES D'ACCÈS RAPIDE (GRILLE 2x2)                      */}
        {/* ======================================================== */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionTitle}>⚡ Entraînement Rapide & Outils</Text>

          <View style={styles.quickGrid}>
            {/* 1. Séance Libre Immédiate */}
            <TouchableOpacity
              style={[styles.quickTile, styles.tileFree]}
              onPress={handleStartFree}
              activeOpacity={0.85}
            >
              <View style={styles.quickTileTop}>
                <Text style={styles.quickTileIcon}>⚡</Text>
                <View style={styles.quickTileBadge}>
                  <Text style={styles.quickTileBadgeText}>1 CLIC</Text>
                </View>
              </View>
              <Text style={styles.quickTileTitle}>Séance Libre</Text>
              <Text style={styles.quickTileSub}>Démarrage direct</Text>
            </TouchableOpacity>

            {/* 2. Coach IA Sur-Mesure */}
            <TouchableOpacity
              style={[styles.quickTile, styles.tileAi]}
              onPress={() => router.push('/workout/ai-generator')}
              activeOpacity={0.85}
            >
              <View style={styles.quickTileTop}>
                <Text style={styles.quickTileIcon}>🤖</Text>
                <View style={[styles.quickTileBadge, styles.badgeAi]}>
                  <Text style={styles.badgeAiText}>IA</Text>
                </View>
              </View>
              <Text style={styles.quickTileTitle}>Générateur IA</Text>
              <Text style={styles.quickTileSub}>Séance calibrée</Text>
            </TouchableOpacity>

            {/* 3. Cibler un Muscle */}
            <TouchableOpacity
              style={[styles.quickTile, styles.tileTarget]}
              onPress={() => router.push('/programs/target-muscle')}
              activeOpacity={0.85}
            >
              <View style={styles.quickTileTop}>
                <Text style={styles.quickTileIcon}>🎯</Text>
                <Text style={styles.quickTileArrow}>❯</Text>
              </View>
              <Text style={styles.quickTileTitle}>Cibler un Muscle</Text>
              <Text style={styles.quickTileSub}>Faisceau précis</Text>
            </TouchableOpacity>

            {/* 4. Catalogue d'Exercices */}
            <TouchableOpacity
              style={[styles.quickTile, styles.tileCatalog]}
              onPress={() => router.push('/exercises')}
              activeOpacity={0.85}
            >
              <View style={styles.quickTileTop}>
                <Text style={styles.quickTileIcon}>📖</Text>
                <Text style={styles.quickTileArrow}>❯</Text>
              </View>
              <Text style={styles.quickTileTitle}>Catalogue</Text>
              <Text style={styles.quickTileSub}>103 exercices</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 4. WIDGET SUIVI DU POIDS & OBJECTIFS                     */}
        {/* ======================================================== */}
        <View style={{ marginTop: 6 }}>
          <WeightHomeWidget refreshTrigger={weightRefreshKey} />
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL : BADGES & GESTION DES POKÉMONS                    */}
      {/* ======================================================== */}
      <Modal
        visible={badgeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBadgeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.badgeModalCard}>
            {/* Header du modal */}
            <View style={styles.badgeModalHeader}>
              <View style={styles.badgeModalIconBox}>
                <Text style={{ fontSize: 32 }}>{levelInfo?.badgeEmoji || '🏅'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeModalTitle}>
                  {levelInfo?.badgeName || 'Badge Roche'}
                </Text>
                <Text style={styles.badgeModalSubtitle}>
                  Niveau {levelInfo?.level || 1} • {levelInfo?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setBadgeModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Informations de palier */}
            <View style={styles.badgeModalStatsRow}>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>{levelInfo?.currentXp || 0}</Text>
                <Text style={styles.badgeModalStatLabel}>XP Cumulés</Text>
              </View>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>
                  {pokemonStats?.hatchedCount || 0}
                </Text>
                <Text style={styles.badgeModalStatLabel}>Pokémon Éclos</Text>
              </View>
              <View style={styles.badgeModalStat}>
                <Text style={styles.badgeModalStatVal}>
                  {pokemonStats?.incubatingCount || 0}
                </Text>
                <Text style={styles.badgeModalStatLabel}>En Incubation</Text>
              </View>
            </View>

            {/* Défilement des 8 Badges de Kanto */}
            <Text style={styles.kantoBadgesTitle}>
              🏛️ Les 8 Badges de Kanto & Ligue
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kantoBadgesScroll}
            >
              {POKEMON_BADGE_TIERS.map((tier) => {
                const isUnlocked = (levelInfo?.currentXp ?? 0) >= tier.minXp;
                const isCurrent = levelInfo?.level === tier.level;

                return (
                  <View
                    key={tier.level}
                    style={[
                      styles.kantoBadgeItem,
                      isCurrent && styles.kantoBadgeCurrent,
                      !isUnlocked && styles.kantoBadgeLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.kantoBadgeEmoji,
                        !isUnlocked && { opacity: 0.3 },
                      ]}
                    >
                      {tier.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.kantoBadgeName,
                        isCurrent && { color: Colors.primary, fontWeight: '800' },
                        !isUnlocked && { color: Colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {tier.badgeName}
                    </Text>
                    <Text style={styles.kantoBadgeXp}>{tier.minXp} XP</Text>
                    {isCurrent && (
                      <View style={styles.currentBadgeTag}>
                        <Text style={styles.currentBadgeTagText}>ACTUEL</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Raccourcis directs vers la gestion */}
            <View style={styles.badgeModalActions}>
              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/(tabs)/history?tab=pokemon');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>🥚</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Incubateurs & Pokédex
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Gérer vos œufs, éclosions et collection
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/(tabs)/history?tab=achievements');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Trophées & Exploits
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Consulter vos défis dresseur et Pokémon légendaires
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.badgeActionBtn}
                onPress={() => {
                  setBadgeModalVisible(false);
                  router.push('/arena');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.badgeActionBtnIcon}>⚔️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeActionBtnTitle}>
                    Arène & Échanges
                  </Text>
                  <Text style={styles.badgeActionBtnSub}>
                    Combattre en ligue, échanger des Pokémon et défier le Raid Boss
                  </Text>
                </View>
                <Text style={styles.badgeActionBtnArrow}>❯</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL : SAISIE DU PSEUDO / COMPTE                        */}
      {/* ======================================================== */}
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
                  ? 'Connectez-vous pour synchroniser vos classements et Pokémon'
                  : 'Renseignez votre pseudo et mot de passe pour les classements partagés.'}
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
                🔒 Connexion permanente : aucune saisie répétée du mot de passe au lancement.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.authToggleModeBtn}
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setAuthError(null);
              }}
            >
              <Text style={styles.authToggleModeText}>
                {isLoginMode
                  ? 'Nouveau dresseur ? Créer un compte ➔'
                  : 'Déjà un compte ? Se connecter ➔'}
              </Text>
            </TouchableOpacity>

            <View style={styles.nameModalButtons}>
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => {
                  setNameModalVisible(false);
                  setPasswordInput('');
                  setAuthError(null);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={
                  authLoading
                    ? 'Validation...'
                    : isLoginMode
                    ? 'Se connecter'
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
  topXpCard: {
    backgroundColor: '#0F1626',
    borderWidth: 1.5,
    borderColor: '#1E2C42',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  topUserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userNameTouch: {
    flex: 1,
  },
  userGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userGreetingText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  editNameIconBox: {
    padding: 2,
  },
  editNameIcon: {
    fontSize: 13,
    opacity: 0.7,
  },
  userSubText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  offlineStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  offlineStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  xpGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FBBF24',
  },
  xpTrackContainer: {
    flex: 1,
  },
  xpTrack: {
    height: 9,
    backgroundColor: '#090E17',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 4,
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#FF5A1F',
    borderRadius: 6,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpNumbersText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  xpPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  endBadgeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1A2338',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  endBadgeEmoji: {
    fontSize: 22,
  },
  endBadgeNotificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  endBadgeSparkle: {
    fontSize: 10,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E140A',
    borderColor: Colors.primary,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  activeBannerContent: {
    flex: 1,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  activeTimer: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  primaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#1F2937',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  multiplayerCardHighlight: {
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: '#121324',
  },
  runningCardHighlight: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: '#0D1A24',
  },
  primaryActionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  multiplayerIconHighlight: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  runningIconHighlight: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  primaryActionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  primaryActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  primaryActionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  primaryActionArrow: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  quickAccessSection: {
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
  },
  tileFree: {
    borderColor: 'rgba(255, 90, 31, 0.35)',
  },
  tileAi: {
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  tileTarget: {
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  tileCatalog: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  quickTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickTileIcon: {
    fontSize: 24,
  },
  quickTileBadge: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickTileBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  badgeAi: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  badgeAiText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C084FC',
  },
  quickTileArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  quickTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  quickTileSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  badgeModalCard: {
    backgroundColor: '#111A29',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#24344D',
    maxHeight: '90%',
  },
  badgeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badgeModalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#1E2C42',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  badgeModalSubtitle: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
  },
  closeModalText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: 'bold',
  },
  badgeModalStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#090E17',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C42',
    marginBottom: 16,
  },
  badgeModalStat: {
    flex: 1,
    alignItems: 'center',
  },
  badgeModalStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 2,
  },
  badgeModalStatLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  kantoBadgesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  kantoBadgesScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  kantoBadgeItem: {
    width: 90,
    backgroundColor: '#0E1624',
    borderWidth: 1,
    borderColor: '#1E2C42',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  kantoBadgeCurrent: {
    borderColor: '#F59E0B',
    backgroundColor: '#1A2338',
  },
  kantoBadgeLocked: {
    opacity: 0.5,
  },
  kantoBadgeEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  kantoBadgeName: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  kantoBadgeXp: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  currentBadgeTag: {
    backgroundColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 4,
  },
  currentBadgeTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#090E17',
  },
  badgeModalActions: {
    gap: 8,
    marginTop: 4,
  },
  badgeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E1624',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C42',
    gap: 12,
  },
  badgeActionBtnIcon: {
    fontSize: 24,
  },
  badgeActionBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  badgeActionBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  badgeActionBtnArrow: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  nameModalCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  nameModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  nameModalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 90, 31, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  nameModalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  authErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  authErrorText: {
    color: '#F87171',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  nameModalInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#2D3748',
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    marginBottom: 12,
  },
  persistentLoginNote: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  persistentLoginNoteText: {
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 15,
  },
  authToggleModeBtn: {
    paddingVertical: 6,
    marginBottom: 14,
    alignItems: 'center',
  },
  authToggleModeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  nameModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
});
