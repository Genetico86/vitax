import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { showAlert } from '../../utils/alert';
import { useSettingsStore } from '../../stores/settingsStore';
import { exportAllData, importDataFromFile } from '../../database/backupService';
import { exportExercisesToJson, importExercisesFromJson } from '../../services/exerciseExportService';
import { resetDatabase } from '../../database/db';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { UserAvatar } from '../../components/common/UserAvatar';
import { AvatarPickerModal } from '../../components/common/AvatarPickerModal';
import { EQUIPMENT_CATALOG_METADATA } from '../../utils/exerciseUnits';
import { EQUIPMENTS } from '../../constants/muscles';
import { getOrCreateTrainerProfile, getFriendsList } from '../../services/multiplayerService';
import {
  getPersistedSession,
  logoutTrainer,
  deleteTrainerAccountAndCloudData,
} from '../../services/authService';
import { TrainerProfile } from '../../types/social';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { DeveloperFeedbackModal } from '../../components/workout/DeveloperFeedbackModal';
import { ChangePasswordModal } from '../../components/auth/ChangePasswordModal';
import { EditEmailModal } from '../../components/auth/EditEmailModal';

export default function SettingsScreen() {
  const {
    user_name,
    avatar_url,
    user_height_cm,
    available_equipments,
    filter_by_available_equipment,
    default_rest_seconds,
    haptic_enabled,
    weight_unit,
    setUserName,
    setAvatarUrl,
    setUserHeight,
    setAvailableEquipments,
    toggleAvailableEquipment,
    setFilterByAvailableEquipment,
    resetAvailableEquipments,
    setDefaultRestSeconds,
    setHapticEnabled,
    setWeightUnit,
  } = useSettingsStore();

  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [isTrainerLoggedIn, setIsTrainerLoggedIn] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [devFeedbackModalVisible, setDevFeedbackModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);

  // États pour les sections dépliables (accordéons)
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [equipmentExpanded, setEquipmentExpanded] = useState(false);
  const [devExpanded, setDevExpanded] = useState(false);

  const loadTrainerData = useCallback(async () => {
    try {
      const prof = await getOrCreateTrainerProfile();
      setTrainerProfile(prof);
      const friends = await getFriendsList();
      setFriendsCount(friends.length);
      const session = await getPersistedSession();
      setIsTrainerLoggedIn(Boolean(session?.isLoggedIn));
    } catch (e) {
      console.warn('Erreur lecture données settings:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrainerData();
    }, [loadTrainerData])
  );

  const handleShareCode = async () => {
    if (!trainerProfile) return;
    const msg = `Ajoute-moi sur Vitax pour comparer nos performances et progresser ensemble ! Mon Code Athlète : ${trainerProfile.friendCode}\nRejoins-moi sur l’application web : https://vitaxsport.vercel.app 🏆`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(trainerProfile.friendCode);
        showAlert('Code copié ! 📋', `Votre Code Ami (${trainerProfile.friendCode}) a été copié dans le presse-papier.`);
        return;
      }
      await Share.share({
        message: msg,
      });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(trainerProfile.friendCode);
          showAlert('Code copié ! 📋', `Votre Code Ami (${trainerProfile.friendCode}) a été copié dans le presse-papier.`);
        } catch {}
      }
    }
  };

  const handleTrainerLogout = () => {
    showAlert(
      'Déconnexion',
      'Voulez-vous vous déconnecter de votre compte Athlète ? Vous devrez vous reconnecter ou créer un compte pour réutiliser l’application.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logoutTrainer();
            await loadTrainerData();
          },
        },
      ]
    );
  };


  const [draftName, setDraftName] = useState<string | null>(null);
  const currentName = draftName !== null ? draftName : (user_name || '');
  const [savedNameSuccess, setSavedNameSuccess] = useState(false);

  const [draftHeight, setDraftHeight] = useState<string | null>(null);
  const currentHeight =
    draftHeight !== null
      ? draftHeight
      : user_height_cm !== undefined && user_height_cm > 0
      ? user_height_cm.toString()
      : '';
  const [savedHeightSuccess, setSavedHeightSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportingExercises, setExportingExercises] = useState(false);
  const [importingExercises, setImportingExercises] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const handleManualCloudSync = async () => {
    setSyncingCloud(true);
    try {
      const { syncCloudAndLocal } = await import('../../services/cloudSyncService');
      await syncCloudAndLocal();
      const { getUserGamificationStats } = await import('../../services/gamificationService');
      await getUserGamificationStats();
      await loadTrainerData();
      showAlert(
        'Synchronisation réussie ✅',
        'Toutes vos séances, séries, pesées et progression ont été synchronisées avec le cloud Vitax.'
      );
    } catch (err: any) {
      showAlert('Erreur de synchronisation', err?.message || 'Impossible de synchroniser avec le cloud.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSaveName = async () => {
    await setUserName(currentName);
    setDraftName(null);
    setSavedNameSuccess(true);
    setTimeout(() => setSavedNameSuccess(false), 2500);
  };

  const handleSaveHeight = async () => {
    const val = parseFloat(currentHeight.replace(',', '.'));
    await setUserHeight(isNaN(val) ? 0 : Math.round(val));
    setDraftHeight(null);
    setSavedHeightSuccess(true);
    setTimeout(() => setSavedHeightSuccess(false), 2500);
  };

  const restOptions = [45, 60, 90, 120, 150, 180];

  const handleExport = async () => {
    setExporting(true);
    const res = await exportAllData();
    setExporting(false);

    if (res.success) {
      showAlert(
        'Exportation réussie',
        'Votre fichier de sauvegarde JSON a été généré et partagé avec succès.'
      );
    } else {
      showAlert('Erreur d’exportation', res.error || 'Impossible d’exporter les données.');
    }
  };

  const handleImport = async () => {
    showAlert(
      'Importer une sauvegarde',
      'L’importation ajoutera ou mettra à jour vos séances et exercices depuis le fichier JSON. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Sélectionner le fichier',
          onPress: async () => {
            setImporting(true);
            const res = await importDataFromFile();
            setImporting(false);

            if (res.success) {
              showAlert(
                'Importation terminée',
                `Vos données ont été restaurées avec succès (${res.sessionsCount ?? 0} séances trouvées).`
              );
            } else if (res.error !== 'Opération annulée') {
              showAlert('Erreur', res.error || 'Échec de l’importation');
            }
          },
        },
      ]
    );
  };

  const handleExportExercises = async () => {
    setExportingExercises(true);
    const res = await exportExercisesToJson();
    setExportingExercises(false);

    if (res.success) {
      showAlert(
        'Exportation réussie ✅',
        `Les ${res.total || 107} exercices du catalogue Vitax (avec fiches posturales, risques, charges adaptées et sous-muscles) ont été exportés dans le fichier :\n${res.fileName || 'vitax_exercices_qualifies.json'}`
      );
    } else {
      showAlert('Erreur d’exportation', res.error || 'Impossible d’exporter les fiches d’exercices.');
    }
  };

  const handleImportExercises = async () => {
    showAlert(
      'Mettre à jour les fiches d’exercices',
      'L’importation va mettre à jour la qualification anatomique, les postures, objectifs et consignes de sécurité des exercices à partir de votre fichier JSON retravaillé. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Sélectionner le fichier JSON',
          onPress: async () => {
            setImportingExercises(true);
            const res = await importExercisesFromJson();
            setImportingExercises(false);

            if (res.success) {
              showAlert(
                'Mise à jour réussie 🎉',
                `${res.total || 0} fiches d’exercices ont été mises à jour avec succès dans votre application !`
              );
            } else if (res.error !== 'Opération annulée') {
              showAlert('Erreur d’importation', res.error || 'Échec de la mise à jour des exercices.');
            }
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    showAlert(
      'Réinitialiser les données locales',
      'Cette action effacera votre base locale SQLite et restaurera les programmes par défaut. Cette action est irréversible !',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            showAlert('Réinitialisé', 'La base de données locale a été remise à zéro.');
          },
        },
      ]
    );
  };

  const handleDeleteAccountAndCloudData = () => {
    showAlert(
      'Supprimer mon compte & mes données Cloud (RGPD)',
      'Conformément au droit à l’effacement (RGPD), cette action supprimera définitivement votre profil, vos séances, vos records, vos pesées et vos amis sur le serveur Cloud Supabase ainsi que sur cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteTrainerAccountAndCloudData();
            if (res.success) {
              setIsTrainerLoggedIn(false);
              setTrainerProfile(null);
              await setUserName('');
              await setAvatarUrl('');
              showAlert(
                'Compte et données supprimés',
                'Votre compte Cloud et toutes vos données personnelles et sportives ont été intégralement effacés.'
              );
            } else {
              showAlert('Erreur', res.error || 'Impossible de supprimer le compte Cloud.');
            }
          },
        },
      ]
    );
  };

  const activeEquipmentCount = (available_equipments || []).length;
  const isFilteringEquipment = filter_by_available_equipment ?? true;

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* ========================================================================= */}
        {/* 1. SECTION UNIQUE DU PROFIL (DÉPLIABLE)                                  */}
        {/* ========================================================================= */}
        <Text style={styles.sectionHeader}>PROFIL & ATHLÈTE</Text>

        <Card style={styles.accordionContainerCard}>
          {/* Entête dépliable du Profil */}
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setProfileExpanded(!profileExpanded)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Déplier ou replier la section Profil"
          >
            <View style={styles.accordionHeaderMain}>
              <UserAvatar
                avatarUrl={avatar_url || trainerProfile?.avatarUrl}
                fallbackEmoji={trainerProfile?.avatarPokemonEmoji || '👤'}
                size={50}
                showEditBadge
                userName={user_name || trainerProfile?.username || 'Mon Profil Athlète'}
                userSubtitle={trainerProfile?.trainerTitle ? `${trainerProfile.trainerTitle} • Ligue ${trainerProfile.currentLeague || 'Bronze'}` : undefined}
                onPress={() => setAvatarPickerVisible(true)}
                onEditPress={() => setAvatarPickerVisible(true)}
                enableEnlarge
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={styles.accordionHeaderTitle}>
                    {user_name || trainerProfile?.username || 'Mon Profil Athlète'}
                  </Text>
                  <View
                    style={[
                      styles.sessionStatusBadge,
                      { backgroundColor: isTrainerLoggedIn ? 'rgba(34, 197, 94, 0.18)' : '#1F2937' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sessionStatusText,
                        { color: isTrainerLoggedIn ? Colors.success : Colors.textMuted },
                      ]}
                    >
                      {isTrainerLoggedIn ? '🟢 Connecté' : '⚪ Mode local'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.accordionHeaderSubtitle}>
                  {trainerProfile?.trainerTitle ? `${trainerProfile.trainerTitle} • ` : ''}
                  Ligue {trainerProfile?.currentLeague || 'Bronze'} • Repos {default_rest_seconds}s
                </Text>
              </View>
            </View>

            <View style={styles.chevronBox}>
              <Text style={styles.chevronText}>{profileExpanded ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {/* Contenu complet dépliable du Profil */}
          {profileExpanded && (
            <View style={styles.accordionBody}>
              <View style={styles.innerDivider} />

              {/* Sous-bloc : Prénom et Photo de profil */}
              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>👤 Identité & Photo</Text>
                <TouchableOpacity
                  onPress={() => setAvatarPickerVisible(true)}
                  activeOpacity={0.7}
                  style={styles.photoActionBtn}
                >
                  <Text style={styles.photoActionBtnText}>📷 Modifier la photo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sublabel}>
                Personnalise votre identité athlète sur l’accueil, dans l’arène et dans les classements.
              </Text>

              <View style={styles.nameInputContainer}>
                <TextInput
                  style={styles.nameTextInput}
                  placeholder="Votre prénom (ex: Thomas, Sarah...)"
                  placeholderTextColor={Colors.textMuted}
                  value={currentName}
                  onChangeText={setDraftName}
                  maxLength={25}
                />
                <TouchableOpacity
                  style={[
                    styles.nameSaveBtn,
                    currentName.trim() === (user_name || '').trim() && styles.nameSaveBtnDisabled,
                  ]}
                  onPress={handleSaveName}
                  disabled={currentName.trim() === (user_name || '').trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nameSaveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>

              {savedNameSuccess && (
                <View style={styles.nameSuccessBadge}>
                  <Text style={styles.nameSuccessText}>
                    ✓ Prénom enregistré avec succès !
                  </Text>
                </View>
              )}

              {/* Sous-bloc : Connexion, Badges & Compte */}
              <View style={styles.innerDivider} />

              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>🏅 Badges & Connexion Athlète</Text>
                <Badge
                  label={`Ligue ${trainerProfile?.currentLeague || 'Bronze'}`}
                  color="rgba(255, 90, 31, 0.18)"
                  textColor={Colors.primary}
                />
              </View>

              {trainerProfile && (
                <View style={styles.trainerDetailCard}>
                  <View style={styles.trainerMetaRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.trainerMetaLabel}>Code Ami Athlète :</Text>
                      <Text style={styles.trainerMetaCode}>{trainerProfile.friendCode}</Text>
                    </View>
                    <TouchableOpacity style={styles.trainerShareBtn} onPress={handleShareCode} activeOpacity={0.8}>
                      <Text style={styles.trainerShareBtnText}>📤 Partager</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.trainerStatsDivider} />

                  {/* Ligne Adresse e-mail */}
                  <View style={styles.trainerMetaRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.trainerMetaLabel}>Adresse e-mail :</Text>
                      <Text
                        style={[
                          styles.trainerMetaValue,
                          !trainerProfile.email && { fontStyle: 'italic', color: Colors.textMuted },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {trainerProfile.email || 'Non renseignée'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.trainerActionBtn}
                      onPress={() => setIsEmailModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.trainerActionBtnText}>
                        {trainerProfile.email ? '✏️ Modifier' : '+ Renseigner'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Ligne Changement de mot de passe (si connecté) */}
                  {isTrainerLoggedIn && (
                    <>
                      <View style={styles.trainerStatsDivider} />
                      <View style={styles.trainerMetaRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.trainerMetaLabel}>Sécurité du compte :</Text>
                          <Text style={styles.trainerMetaSub}>Mot de passe protégé (PBKDF2)</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.trainerActionBtn}
                          onPress={() => setIsPasswordModalVisible(true)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.trainerActionBtnText}>🔑 Modifier</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <View style={styles.trainerStatsDivider} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.push('/arena')} activeOpacity={0.7}>
                      <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                        👥 {friendsCount} ami(s) dans votre cercle • Gérer ❯
                      </Text>
                    </TouchableOpacity>
                    {isTrainerLoggedIn ? (
                      <TouchableOpacity onPress={handleTrainerLogout} activeOpacity={0.7}>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Se déconnecter</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => router.push('/arena')} activeOpacity={0.7}>
                        <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '800' }}>⚡ Se connecter ❯</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {!isTrainerLoggedIn && (
                <View style={styles.loginBannerCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 24 }}>☁️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loginBannerTitle}>Compte & Synchronisation Cloud</Text>
                      <Text style={styles.loginBannerSub}>
                        Connectez-vous pour sauvegarder et restaurer vos séances et statistiques sur tous vos appareils.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.loginBannerBtn}
                    onPress={() => router.push('/arena')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.loginBannerBtnText}>⚡ Se connecter / Créer un compte</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Sous-bloc : Taille de l'athlète */}
              <View style={styles.innerDivider} />

              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>📏 Mensurations & IMC</Text>
              </View>
              <Text style={styles.sublabel}>
                Renseignez votre taille en centimètres pour calculer automatiquement votre Indice de Masse Corporelle (IMC) lors des pesées.
              </Text>

              <View style={styles.nameInputContainer}>
                <TextInput
                  style={styles.nameTextInput}
                  placeholder="Votre taille en cm (ex: 178)"
                  placeholderTextColor={Colors.textMuted}
                  value={currentHeight}
                  onChangeText={setDraftHeight}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <TouchableOpacity
                  style={[
                    styles.nameSaveBtn,
                    currentHeight.trim() ===
                      (user_height_cm !== undefined && user_height_cm > 0
                        ? user_height_cm.toString()
                        : '') && styles.nameSaveBtnDisabled,
                  ]}
                  onPress={handleSaveHeight}
                  disabled={
                    currentHeight.trim() ===
                    (user_height_cm !== undefined && user_height_cm > 0
                      ? user_height_cm.toString()
                      : '')
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.nameSaveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>

              {savedHeightSuccess && (
                <View style={styles.nameSuccessBadge}>
                  <Text style={styles.nameSuccessText}>
                    ✓ Taille enregistrée avec succès !
                  </Text>
                </View>
              )}

              {/* Sous-bloc : Paramètres des temps de repos & Entraînement */}
              <View style={styles.innerDivider} />

              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>⏱️ Paramètres des temps de repos</Text>
              </View>
              <Text style={styles.sublabel}>
                Durée du compte à rebours lancé automatiquement après chaque validation de série.
              </Text>

              <View style={styles.restOptionsRow}>
                {restOptions.map((sec) => {
                  const isSelected = default_rest_seconds === sec;
                  const mins = Math.floor(sec / 60);
                  const remSec = sec % 60;
                  const label = mins > 0 ? (remSec > 0 ? `${mins}m${remSec}` : `${mins}min`) : `${sec}s`;

                  return (
                    <TouchableOpacity
                      key={sec}
                      style={[styles.restChip, isSelected && styles.restChipActive]}
                      onPress={() => setDefaultRestSeconds(sec)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.restChipText, isSelected && styles.restChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 16 }}>
                <View style={styles.settingRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.label}>Retour haptique (Vibrations)</Text>
                    <Text style={styles.sublabel}>Vibrer lors de la validation d’une série et fin du repos</Text>
                  </View>
                  <Switch
                    value={haptic_enabled}
                    onValueChange={setHapticEnabled}
                    thumbColor={haptic_enabled ? Colors.primary : '#4B5563'}
                    trackColor={{ false: '#374151', true: 'rgba(255, 90, 31, 0.4)' }}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <View style={styles.settingRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.label}>Unité de mesure</Text>
                    <Text style={styles.sublabel}>Affichage des charges (KG ou LBS)</Text>
                  </View>
                  <View style={styles.unitToggle}>
                    <TouchableOpacity
                      style={[styles.unitBtn, weight_unit === 'kg' && styles.unitBtnActive]}
                      onPress={() => setWeightUnit('kg')}
                    >
                      <Text style={[styles.unitBtnText, weight_unit === 'kg' && styles.unitBtnTextActive]}>
                        KG
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitBtn, weight_unit === 'lbs' && styles.unitBtnActive]}
                      onPress={() => setWeightUnit('lbs')}
                    >
                      <Text style={[styles.unitBtnText, weight_unit === 'lbs' && styles.unitBtnTextActive]}>
                        LBS
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* ========================================================================= */}
        {/* 2. SECTION DÉPLIABLE POUR LE MATÉRIEL DISPONIBLE                        */}
        {/* ========================================================================= */}
        <Text style={styles.sectionHeader}>MATÉRIEL DISPONIBLE</Text>

        <Card style={styles.accordionContainerCard}>
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setEquipmentExpanded(!equipmentExpanded)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Déplier ou replier la section Matériel disponible"
          >
            <View style={styles.accordionHeaderMain}>
              <View style={styles.sectionIconBox}>
                <Text style={{ fontSize: 22 }}>🏋️</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.accordionHeaderTitle}>Matériel & Équipements</Text>
                  <Badge
                    label={`${activeEquipmentCount} / ${EQUIPMENTS.length} cochés`}
                    color="rgba(56, 189, 248, 0.15)"
                    textColor="#38BDF8"
                  />
                </View>
                <Text style={styles.accordionHeaderSubtitle}>
                  {isFilteringEquipment
                    ? 'Filtre automatique actif selon vos équipements'
                    : 'Filtre inactif (tous les exercices affichés)'}
                </Text>
              </View>
            </View>

            <View style={styles.chevronBox}>
              <Text style={styles.chevronText}>{equipmentExpanded ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {equipmentExpanded && (
            <View style={styles.accordionBody}>
              <View style={styles.innerDivider} />

              <View style={styles.settingRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.label}>Filtrer selon mon matériel</Text>
                  <Text style={styles.sublabel}>
                    Masque automatiquement les programmes et exercices nécessitant du matériel non coché
                  </Text>
                </View>
                <Switch
                  value={filter_by_available_equipment ?? true}
                  onValueChange={setFilterByAvailableEquipment}
                  thumbColor={filter_by_available_equipment ? Colors.primary : '#4B5563'}
                  trackColor={{ false: '#374151', true: 'rgba(255, 90, 31, 0.4)' }}
                />
              </View>

              {/* Actions rapides */}
              <View style={styles.equipmentQuickActionsRow}>
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={resetAvailableEquipments}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionBtnText}>Tout cocher ({EQUIPMENTS.length})</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={() => setAvailableEquipments(['Sans matériel'])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionBtnText}>Sans matériel uniquement</Text>
                </TouchableOpacity>
              </View>

              {/* Compteur d'équipements sélectionnés */}
              <View style={styles.equipmentCounterBadge}>
                <Text style={styles.equipmentCounterText}>
                  ✓ {activeEquipmentCount} / {EQUIPMENTS.length} équipements cochés
                </Text>
              </View>

              {/* Liste des équipements avec cases à cocher ergonomiques */}
              <View style={styles.equipmentListContainer}>
                {EQUIPMENT_CATALOG_METADATA.map((eqItem) => {
                  const isSelected = (available_equipments || []).includes(eqItem.key);

                  return (
                    <TouchableOpacity
                      key={eqItem.key}
                      style={[
                        styles.equipmentItemCard,
                        isSelected && styles.equipmentItemCardActive,
                      ]}
                      onPress={() => toggleAvailableEquipment(eqItem.key)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.equipmentCheckboxBox}>
                        <Text style={[styles.equipmentCheckboxText, isSelected && styles.equipmentCheckboxTextActive]}>
                          {isSelected ? '✓' : '○'}
                        </Text>
                      </View>

                      <View style={styles.equipmentItemEmojiBox}>
                        <Text style={{ fontSize: 20 }}>{eqItem.emoji}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.equipmentItemTitle, isSelected && styles.equipmentItemTitleActive]}>
                          {eqItem.label}
                        </Text>
                        <Text style={styles.equipmentItemSub} numberOfLines={2}>
                          {eqItem.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.equipmentHintBox}>
                <Text style={styles.equipmentHintText}>
                  💡 Vitax adapte automatiquement le catalogue des exercices, les programmes proposés sur l’accueil et le ciblage par muscle à cette sélection.
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* ========================================================================= */}
        {/* 3. BOUTON SYNCHRO DE SÉANCES                                             */}
        {/* ========================================================================= */}
        <Text style={styles.sectionHeader}>SYNCHRONISATION DES SÉANCES</Text>

        <Card style={styles.syncCard}>
          <View style={styles.syncHeaderRow}>
            <View style={styles.syncIconBox}>
              <Text style={{ fontSize: 22 }}>🔄</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={styles.syncCardTitle}>Synchro de séances</Text>
                <Badge
                  label={isSupabaseConfigured() ? 'Cloud actif' : 'Hors-ligne'}
                  color={isSupabaseConfigured() ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)'}
                  textColor={isSupabaseConfigured() ? '#4ADE80' : '#FACC15'}
                />
              </View>
              <Text style={styles.syncCardSub}>
                La synchronisation se fait automatiquement en arrière-plan. Vous pouvez forcer l’envoi et la récupération immédiate de vos séances d’entraînement ici.
              </Text>
            </View>
          </View>

          <Button
            title={syncingCloud ? 'Synchronisation en cours...' : '🔄 Synchroniser mes séances maintenant'}
            variant="primary"
            onPress={handleManualCloudSync}
            loading={syncingCloud}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* ========================================================================= */}
        {/* 4. MODE DEV AVEC SAUVEGARDE, MIGRATIONS & CATALOGUE FICHES D'EXERCICES     */}
        {/* ========================================================================= */}
        <Text style={styles.sectionHeader}>MODE DÉVELOPPEUR & DONNÉES</Text>

        <Card style={styles.accordionContainerCard}>
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setDevExpanded(!devExpanded)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Déplier ou replier le Mode Développeur"
          >
            <View style={styles.accordionHeaderMain}>
              <View style={[styles.sectionIconBox, styles.devIconBox]}>
                <Text style={{ fontSize: 22 }}>🛠️</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.accordionHeaderTitle}>Mode Développeur</Text>
                  <Badge label="Avancé" color="rgba(168, 85, 247, 0.15)" textColor="#C084FC" />
                </View>
                <Text style={styles.accordionHeaderSubtitle}>
                  Sauvegarde & migrations, catalogue et fiches d’exercices
                </Text>
              </View>
            </View>

            <View style={styles.chevronBox}>
              <Text style={styles.chevronText}>{devExpanded ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {devExpanded && (
            <View style={styles.accordionBody}>
              <View style={styles.innerDivider} />

              {/* Bloc 1 : Sauvegarde & Migration */}
              <Text style={styles.subBlockTitle}>📦 Sauvegarde & Migration</Text>
              <Text style={styles.sublabel}>
                Exportez ou restaurez un fichier JSON complet comprenant votre historique, vos programmes et vos séances.
              </Text>

              <Button
                title={exporting ? 'Génération en cours...' : '📥 Exporter mes données (JSON)'}
                variant="outline"
                onPress={handleExport}
                loading={exporting}
                style={{ marginTop: 8 }}
              />

              <Button
                title={importing ? 'Restauration en cours...' : '📤 Importer une sauvegarde (JSON)'}
                variant="secondary"
                onPress={handleImport}
                loading={importing}
                style={{ marginTop: 10 }}
              />

              {/* Bloc 2 : Catalogue & Fiches d'exercices */}
              <View style={styles.innerDivider} />

              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>📋 Catalogue & Fiches d’exercices</Text>
                <Badge label="107 Exercices" color="rgba(6, 182, 212, 0.2)" textColor="#06B6D4" />
              </View>
              <Text style={styles.sublabel}>
                Exportez l’intégralité des données d’exercices (anatomie détaillée, postures, objectifs, charges recommandées et consignes de sécurité) pour les auditer ou réinjecter un JSON enrichi.
              </Text>

              <Button
                title={exportingExercises ? 'Génération du catalogue...' : '📥 Exporter les 107 fiches d’exercices (JSON)'}
                variant="outline"
                onPress={handleExportExercises}
                loading={exportingExercises}
                style={{ marginTop: 8 }}
              />

              <Button
                title={importingExercises ? 'Mise à jour en cours...' : '📤 Importer / Mettre à jour les fiches (JSON)'}
                variant="secondary"
                onPress={handleImportExercises}
                loading={importingExercises}
                style={{ marginTop: 10 }}
              />

              {/* Bloc 3 : Retours & Évaluations des Exercices */}
              <View style={styles.innerDivider} />

              <View style={styles.subBlockHeaderRow}>
                <Text style={styles.subBlockTitle}>⭐ Retours & Évaluations des Exercices</Text>
                <Badge label="Feedback Dev" color="rgba(245, 158, 11, 0.2)" textColor="#FBBF24" />
              </View>
              <Text style={styles.sublabel}>
                Consultez toutes les notes attribuées par les utilisateurs, les remarques anatomiques et exportez les rapports pour perfectionner les exercices.
              </Text>

              <Button
                title="🔍 Consulter les retours & notes dev"
                variant="primary"
                onPress={() => setDevFeedbackModalVisible(true)}
                style={{ marginTop: 8 }}
              />

            </View>
          )}
        </Card>

        {/* ========================================================================= */}
        {/* 5. ZONE DE DANGER & CONFORMITÉ RGPD                                      */}
        {/* ========================================================================= */}
        <Text style={[styles.sectionHeader, { color: Colors.danger }]}>ZONE DE DANGER & RGPD</Text>

        <Card style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
          <Text style={[styles.label, { color: Colors.danger }]}>Réinitialiser la base de données locale</Text>
          <Text style={styles.sublabel}>
            Efface toutes les séances locales et réinitialise les programmes aux valeurs d’usine sur cet appareil.
          </Text>
          <Button
            title="Remettre à zéro les données locales"
            variant="danger"
            onPress={handleResetData}
            style={{ marginTop: 12 }}
          />

          <View style={styles.innerDivider} />

          <Text style={[styles.label, { color: Colors.danger }]}>
            Droit à l’oubli — Supprimer mon compte Cloud (RGPD)
          </Text>
          <Text style={styles.sublabel}>
            Supprime définitivement votre profil athlète et l’intégralité de vos données sportives et personnelles sur Supabase et sur cet appareil.
          </Text>
          <Button
            title="🗑️ Supprimer mon compte et mes données Cloud"
            variant="danger"
            onPress={handleDeleteAccountAndCloudData}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Vitax Musculation • Version 1.0.0 Offline-First</Text>
          <Text style={styles.footerSub}>Conçu pour la performance et la rapidité d’exécution</Text>
        </View>
      </ScrollView>

      {/* Modal de sélection d'avatar (Selfie / Galerie) */}
      <AvatarPickerModal
        visible={avatarPickerVisible}
        currentAvatarUrl={avatar_url || trainerProfile?.avatarUrl}
        onClose={() => setAvatarPickerVisible(false)}
        onAvatarSelected={async (url) => {
          await setAvatarUrl(url);
          if (trainerProfile) {
            setTrainerProfile({ ...trainerProfile, avatarUrl: url });
          }
        }}
      />

      {/* Modal de consultation des retours développeur */}
      <DeveloperFeedbackModal
        visible={devFeedbackModalVisible}
        onClose={() => setDevFeedbackModalVisible(false)}
      />

      {/* Modal de changement de mot de passe */}
      <ChangePasswordModal
        visible={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
      />

      {/* Modal de modification de l'adresse e-mail */}
      <EditEmailModal
        visible={isEmailModalVisible}
        initialEmail={trainerProfile?.email || null}
        onClose={() => setIsEmailModalVisible(false)}
        onSuccess={(newEmail) => {
          if (trainerProfile) {
            setTrainerProfile({ ...trainerProfile, email: newEmail });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 14,
  },
  card: {
    marginBottom: 16,
  },
  accordionContainerCard: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    borderColor: Colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 20,
  },
  accordionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  accordionHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accordionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  accordionHeaderSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  chevronText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  innerDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 14,
  },
  subBlockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subBlockTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  photoActionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  photoActionBtnText: {
    color: '#38BDF8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sectionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  devIconBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  syncCard: {
    marginBottom: 16,
    backgroundColor: Colors.cardBg,
    borderColor: Colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 20,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.25)',
  },
  syncCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  syncCardSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  sublabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  restOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  restChip: {
    backgroundColor: Colors.cardElevated,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  restChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  restChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  restChipTextActive: {
    color: '#FFFFFF',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#162235',
    borderRadius: 8,
    padding: 3,
  },
  unitBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: Colors.primary,
  },
  unitBtnText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  unitBtnTextActive: {
    color: '#FFFFFF',
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameTextInput: {
    flex: 1,
    backgroundColor: '#0F1726',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22324B',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nameSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSaveBtnDisabled: {
    backgroundColor: '#2A3649',
    opacity: 0.6,
  },
  nameSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  nameSuccessBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  nameSuccessText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  trainerDetailCard: {
    backgroundColor: '#0D1624',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#1D2D42',
  },
  sessionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sessionStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  trainerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#080E18',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#182436',
  },
  trainerMetaLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  trainerMetaValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  trainerMetaSub: {
    color: Colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  trainerActionBtn: {
    backgroundColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  trainerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  trainerMetaCode: {
    color: '#FF7A45',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trainerShareBtn: {
    backgroundColor: 'rgba(255, 90, 31, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.4)',
  },
  trainerShareBtnText: {
    color: '#FF7A45',
    fontSize: 11.5,
    fontWeight: '800',
  },
  trainerStatsDivider: {
    height: 1,
    backgroundColor: '#182436',
    marginVertical: 10,
  },
  loginBannerCard: {
    backgroundColor: '#0C1728',
    borderColor: '#0284C7',
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  loginBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loginBannerSub: {
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 2,
  },
  loginBannerBtn: {
    marginTop: 10,
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  equipmentQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#162235',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#24344E',
  },
  quickActionBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  equipmentCounterBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  equipmentCounterText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  equipmentListContainer: {
    gap: 8,
  },
  equipmentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1826',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1C293D',
  },
  equipmentItemCardActive: {
    backgroundColor: '#122338',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  equipmentCheckboxBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#182436',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#25364E',
  },
  equipmentCheckboxText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  equipmentCheckboxTextActive: {
    color: '#4ADE80',
  },
  equipmentItemEmojiBox: {
    marginRight: 10,
  },
  equipmentItemTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  equipmentItemTitleActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  equipmentItemSub: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  equipmentHintBox: {
    backgroundColor: '#0D1522',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1A273A',
  },
  equipmentHintText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  footer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  footerSub: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
});
