import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Share,
  Linking,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useSettingsStore } from '../../stores/settingsStore';
import { exportAllData, importDataFromFile } from '../../database/backupService';
import { resetDatabase } from '../../database/db';
import { Colors } from '../../constants/colors';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EQUIPMENT_CATALOG_METADATA } from '../../utils/exerciseUnits';
import { EQUIPMENTS } from '../../constants/muscles';
import { getOrCreateTrainerProfile, getFriendsList } from '../../services/multiplayerService';
import { getPersistedSession, logoutTrainer } from '../../services/authService';
import { TrainerProfile } from '../../types/social';

export default function SettingsScreen() {
  const {
    user_name,
    user_height_cm,
    available_equipments,
    filter_by_available_equipment,
    default_rest_seconds,
    haptic_enabled,
    weight_unit,
    setUserName,
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
    try {
      await Share.share({
        message: `Ajoute-moi sur Vitax pour comparer nos performances et échanger nos Pokémon ! Mon Code Dresseur : ${trainerProfile.friendCode} 🏆`,
      });
    } catch {}
  };

  const handleTrainerLogout = () => {
    Alert.alert(
      'Déconnexion Dresseur',
      'Voulez-vous vous déconnecter de votre compte Dresseur partagé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logoutTrainer();
            await loadTrainerData();
            Alert.alert('Déconnecté', 'Session fermée.');
          },
        },
      ]
    );
  };

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert(
        'Mises à jour non actives',
        'Cette version installée sur votre smartphone ne contient pas le module natif de mise à jour automatique. Veuillez installer l’APK autonome officiel généré par EAS pour activer les mises à jour automatiques.',
        [
          { text: 'Compris' },
          {
            text: 'Télécharger le bon APK',
            onPress: () =>
              Linking.openURL(
                'https://expo.dev/artifacts/eas/06idgnR7W-kUUaqdLC_8CLekX2jVI1aYRSOOj-nKw1c.apk'
              ),
          },
        ]
      );
      return;
    }

    setCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          'Mise à jour trouvée ! 🚀',
          'Une nouvelle version est disponible sur le serveur. Téléchargement et application...',
          [
            {
              text: 'Installer maintenant',
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (err: any) {
                  Alert.alert('Erreur', err.message || 'Échec du téléchargement.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Application à jour ✅',
          `Vous utilisez déjà la dernière version disponible sur le canal « ${Updates.channel || 'preview'} ».\n(ID: ${
            Updates.updateId ? Updates.updateId.substring(0, 10) : 'Version initiale'
          })`
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Erreur de vérification',
        err.message || 'Impossible de contacter le serveur de mise à jour.'
      );
    } finally {
      setCheckingUpdate(false);
    }
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
      Alert.alert(
        'Exportation réussie',
        'Votre fichier de sauvegarde JSON a été généré et partagé avec succès.'
      );
    } else {
      Alert.alert('Erreur d’exportation', res.error || 'Impossible d’exporter les données.');
    }
  };

  const handleImport = async () => {
    Alert.alert(
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
              Alert.alert(
                'Importation terminée',
                `Vos données ont été restaurées avec succès (${res.sessionsCount ?? 0} séances trouvées).`
              );
            } else if (res.error !== 'Opération annulée') {
              Alert.alert('Erreur', res.error || 'Échec de l’importation');
            }
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Réinitialiser toutes les données',
      'Cette action effacera tout votre historique d’entraînement et restaurera les programmes par défaut. Cette action est irréversible !',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            await resetDatabase();
            Alert.alert('Réinitialisé', 'La base de données a été remise à zéro.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Badge Réseau & Synchronisation Dresseurs */}
      <Card style={styles.offlineCard}>
        <View style={styles.offlineHeader}>
          <Text style={styles.offlineIcon}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitle}>Base Partagée & Réseau Vitax</Text>
            <Text style={styles.offlineSub}>
              Vos données restent enregistrées localement et synchronisent vos classements, vos Pokémon et votre cercle d’amis sur la ligue générale.
            </Text>
          </View>
        </View>
      </Card>

      {/* Section Profil & Identité */}
      <Text style={styles.sectionHeader}>PROFIL & ATHLÈTE</Text>

      {/* Carte Compte Dresseur & Code Ami */}
      {trainerProfile && (
        <Card style={styles.trainerCard}>
          <View style={styles.trainerHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.trainerAvatarCircle}>
                <Text style={{ fontSize: 24 }}>{trainerProfile.avatarPokemonEmoji || '⚡'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trainerProfileTitle}>{trainerProfile.username}</Text>
                <Text style={styles.trainerProfileSub}>
                  {trainerProfile.trainerTitle} • Ligue {trainerProfile.currentLeague}
                </Text>
              </View>
            </View>
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
                {isTrainerLoggedIn ? '🟢 Connecté' : 'Mode local'}
              </Text>
            </View>
          </View>

          <View style={styles.trainerMetaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trainerMetaLabel}>Code Ami Dresseur :</Text>
              <Text style={styles.trainerMetaCode}>{trainerProfile.friendCode}</Text>
            </View>
            <TouchableOpacity style={styles.trainerShareBtn} onPress={handleShareCode} activeOpacity={0.8}>
              <Text style={styles.trainerShareBtnText}>📤 Partager</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.trainerStatsDivider} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/arena')} activeOpacity={0.7}>
              <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                👥 {friendsCount} ami(s) dans votre cercle • Gérer ❯
              </Text>
            </TouchableOpacity>
            {isTrainerLoggedIn && (
              <TouchableOpacity onPress={handleTrainerLogout} activeOpacity={0.7}>
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Déconnexion</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      )}

      <Card style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.profileAvatarBox}>
            <Text style={{ fontSize: 22 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prénom de l’athlète</Text>
            <Text style={styles.sublabel}>
              Personnalise la salutation « Bonjour l’athlète » sur l’écran d’accueil
            </Text>
          </View>
        </View>

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

        <View style={styles.divider} />

        <View style={styles.profileRow}>
          <View style={styles.profileAvatarBox}>
            <Text style={{ fontSize: 22 }}>📏</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Taille de l’athlète (cm)</Text>
            <Text style={styles.sublabel}>
              Utilisée pour calculer automatiquement votre Indice de Masse Corporelle (IMC)
            </Text>
          </View>
        </View>

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
      </Card>

      {/* Section Matériel & Équipements Disponibles */}
      <Text style={styles.sectionHeader}>MATÉRIEL DISPONIBLE (ÉQUIPEMENTS)</Text>

      <Card style={styles.card}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Filtrer selon mon matériel</Text>
            <Text style={styles.sublabel}>
              Masque les programmes et exercices nécessitant du matériel non coché
            </Text>
          </View>
          <Switch
            value={filter_by_available_equipment ?? true}
            onValueChange={setFilterByAvailableEquipment}
            thumbColor={filter_by_available_equipment ? Colors.primary : '#4B5563'}
            trackColor={{ false: '#374151', true: 'rgba(255, 90, 31, 0.4)' }}
          />
        </View>

        <View style={styles.divider} />

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
            ✓ {(available_equipments || []).length} / {EQUIPMENTS.length} équipements cochés
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
      </Card>

      {/* Section Paramètres d'entraînement */}
      <Text style={styles.sectionHeader}>ENTRAÎNEMENT & REPOS</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Temps de repos par défaut</Text>
        <Text style={styles.sublabel}>
          Durée du compte à rebours lancé automatiquement après chaque série
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

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
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

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unité de mesure</Text>
            <Text style={styles.sublabel}>Affichage des charges</Text>
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
      </Card>

      {/* Section Sauvegarde et Restauration */}
      <Text style={styles.sectionHeader}>SAUVEGARDE & MIGRATION</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>Exporter vos données</Text>
        <Text style={styles.sublabel}>
          Générez un fichier JSON de sauvegarde de tout votre historique, programmes et exercices pour
          le conserver ou le transférer.
        </Text>
        <Button
          title="Exporter mes données (JSON)"
          variant="outline"
          onPress={handleExport}
          loading={exporting}
          style={{ marginTop: 12 }}
        />

        <View style={styles.divider} />

        <Text style={styles.label}>Importer une sauvegarde</Text>
        <Text style={styles.sublabel}>
          Restaurez une sauvegarde précédemment exportée sur un autre téléphone.
        </Text>
        <Button
          title="Importer un fichier (JSON)"
          variant="secondary"
          onPress={handleImport}
          loading={importing}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Section Zone de danger */}
      <Text style={[styles.sectionHeader, { color: Colors.danger }]}>ZONE DE DANGER</Text>

      <Card style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
        <Text style={[styles.label, { color: Colors.danger }]}>Réinitialiser la base de données</Text>
        <Text style={styles.sublabel}>
          Efface toutes les séances passées et réinitialise les programmes aux valeurs d’usine.
        </Text>
        <Button
          title="Remettre à zéro les données"
          variant="danger"
          onPress={handleResetData}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Section Mises à jour de l'application */}
      <Text style={styles.sectionHeader}>MISES À JOUR DE L’APPLICATION</Text>

      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.label}>Mises à jour en direct (OTA)</Text>
          <Badge
            label={Updates.isEnabled ? 'Prêt (EAS)' : 'Non actif'}
            color={Updates.isEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
            textColor={Updates.isEnabled ? Colors.success : Colors.danger}
          />
        </View>

        <Text style={styles.sublabel}>
          Téléchargez les nouveaux modes, écrans et correctifs sans réinstaller l’APK.
        </Text>

        <View style={styles.updateInfoBox}>
          <Text style={styles.updateInfoRow}>
            Canal : <Text style={styles.updateInfoVal}>{Updates.channel || 'preview'}</Text>
          </Text>
          <Text style={styles.updateInfoRow}>
            Version Runtime : <Text style={styles.updateInfoVal}>{Updates.runtimeVersion || '1.0.0'}</Text>
          </Text>
          <Text style={styles.updateInfoRow}>
            Mise à jour active : <Text style={styles.updateInfoVal}>{Updates.updateId ? `${Updates.updateId.substring(0, 10)}...` : 'Version de base'}</Text>
          </Text>
        </View>

        <Button
          title={checkingUpdate ? 'Recherche en cours...' : '🔄 Vérifier les mises à jour en direct'}
          variant="primary"
          onPress={handleCheckUpdate}
          disabled={checkingUpdate}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Footer À propos */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Vitax Musculation • Version 1.0.0 Offline-First</Text>
        <Text style={styles.footerSub}>Conçu pour la performance et la rapidité d’exécution</Text>
      </View>
    </ScrollView>
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
  offlineCard: {
    backgroundColor: '#111D2E',
    borderColor: '#1D3557',
    marginBottom: 20,
  },
  offlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  offlineTitle: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  offlineSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 10,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
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
    backgroundColor: '#162235',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25354F',
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
  divider: {
    height: 1,
    backgroundColor: '#1E2C42',
    marginVertical: 14,
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameTextInput: {
    flex: 1,
    backgroundColor: '#121A28',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24344E',
    color: '#FFFFFF',
    fontSize: 15,
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
  equipmentQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
    backgroundColor: '#121A28',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2C42',
  },
  equipmentItemCardActive: {
    backgroundColor: '#122338',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  equipmentCheckboxBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1A2538',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#283852',
  },
  equipmentCheckboxText: {
    color: Colors.textMuted,
    fontSize: 14,
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
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  equipmentHintText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  trainerCard: {
    backgroundColor: '#131C2D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#263750',
  },
  trainerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trainerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E2C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerProfileTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  trainerProfileSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sessionStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trainerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1624',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1D2A3D',
  },
  trainerMetaLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  trainerMetaCode: {
    color: '#FF7A45',
    fontSize: 16,
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
    fontSize: 12,
    fontWeight: '800',
  },
  trainerStatsDivider: {
    height: 1,
    backgroundColor: '#1C293D',
    marginVertical: 10,
  },
  updateInfoBox: {
    backgroundColor: '#0F1626',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2C40',
    gap: 4,
    marginTop: 4,
  },
  updateInfoRow: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  updateInfoVal: {
    color: '#00E5FF',
    fontWeight: '800',
  },
});
