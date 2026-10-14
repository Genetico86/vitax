import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import {
  IncubatorSlot,
  PokemonEgg,
} from '../../types';
import {
  EGG_RARITY_CONFIG,
  placeEggInSlot,
  removeEggFromSlot,
} from '../../services/pokemonEggService';

interface PokemonHubProps {
  totalXp: number;
  incubatorSlots: IncubatorSlot[];
  inventoryEggs: PokemonEgg[];
  incubatingEggs: PokemonEgg[];
  hatchedPokemon: PokemonEgg[];
  onRefreshData: () => Promise<void>;
}

export const PokemonHub: React.FC<PokemonHubProps> = ({
  totalXp,
  incubatorSlots,
  inventoryEggs,
  incubatingEggs,
  hatchedPokemon,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'incubators' | 'challenges' | 'pokedex'>('incubators');
  const [selectedSlotForPlacement, setSelectedSlotForPlacement] = useState<number | null>(null);
  const [eggPickerVisible, setEggPickerVisible] = useState(false);
  const [inspectPokemon, setInspectPokemon] = useState<PokemonEgg | null>(null);

  // Gérer le placement d'un œuf dans un slot
  const handleOpenPickerForSlot = (slotNumber: number) => {
    setSelectedSlotForPlacement(slotNumber);
    setEggPickerVisible(true);
  };

  const handlePlaceEgg = async (eggId: string) => {
    if (selectedSlotForPlacement === null) return;
    const success = await placeEggInSlot(eggId, selectedSlotForPlacement);
    if (success) {
      setEggPickerVisible(false);
      setSelectedSlotForPlacement(null);
      await onRefreshData();
    } else {
      Alert.alert('Erreur', 'Ce slot est déjà occupé.');
    }
  };

  const handleRemoveEgg = (eggId: string, eggName: string) => {
    Alert.alert(
      'Retirer de l’incubateur',
      `Voulez-vous remettre l’${eggName} dans votre inventaire ? Sa progression d’XP sera conservée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          onPress: async () => {
            await removeEggFromSlot(eggId);
            await onRefreshData();
          },
        },
      ]
    );
  };

  // Liste des Défis Légendaires
  const legendaryChallenges = [
    {
      id: 'rack_master',
      speciesId: 'electhor',
      name: 'Électhor',
      emoji: '⚡',
      type: 'Électrik / Vol',
      cp: '2 850 CP',
      challengeTitle: 'Champion du Rack 900',
      description: 'Valider une séance d’entraînement sur la cage & poulies haute/basse',
      req: '1 séance Rack 900',
    },
    {
      id: 'ten_tonnes',
      speciesId: 'artikodin',
      name: 'Artikodin',
      emoji: '❄️',
      type: 'Glace / Vol',
      cp: '2 800 CP',
      challengeTitle: 'Force de Ronflex',
      description: 'Déplacer plus de 10 000 kg de fonte cumulés au total',
      req: '10 000 kg cumulés',
    },
    {
      id: 'century_sets',
      speciesId: 'sulfura',
      name: 'Sulfura',
      emoji: '🔥',
      type: 'Feu / Vol',
      cp: '2 900 CP',
      challengeTitle: 'Attaque Combo (50 Séries)',
      description: 'Valider 50 séries complètes d’effort intense',
      req: '50 séries d’effort',
    },
    {
      id: 'kanto_master_tier',
      speciesId: 'mewtwo',
      name: 'Mewtwo',
      emoji: '🧬',
      type: 'Psy Suprême',
      cp: '3 500 CP',
      challengeTitle: 'Badge Terre (8 Badges)',
      description: 'Conquérir les 8 Badges de Kanto en atteignant 10 500 XP au total',
      req: '10 500 XP cumulés',
    },
    {
      id: 'veteran_titan',
      speciesId: 'mew',
      name: 'Mew',
      emoji: '🌟',
      type: 'Psy Fabuleux',
      cp: '3 200 CP',
      challengeTitle: 'Maître du Conseil 4',
      description: 'Atteindre le cap légendaire des 20 séances d’entraînement terminées',
      req: '20 séances validées',
    },
  ];

  return (
    <View style={styles.container}>
      {/* En-tête de synthèse */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{incubatingEggs.length}</Text>
          <Text style={styles.summaryLabel}>En incubation</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{inventoryEggs.length}</Text>
          <Text style={styles.summaryLabel}>En réserve</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: Colors.accent }]}>
            {hatchedPokemon.length}
          </Text>
          <Text style={styles.summaryLabel}>Éclos / Pokédex</Text>
        </View>
      </View>

      {/* Sous-onglets */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'incubators' && styles.subTabButtonActive,
          ]}
          onPress={() => setActiveSubTab('incubators')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'incubators' && styles.subTabTextActive,
            ]}
          >
            🥚 Incubateurs ({incubatorSlots.filter((s) => s.is_unlocked).length}/4)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'challenges' && styles.subTabButtonActive,
          ]}
          onPress={() => setActiveSubTab('challenges')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'challenges' && styles.subTabTextActive,
            ]}
          >
            ⭐ Légendaires
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'pokedex' && styles.subTabButtonActive,
          ]}
          onPress={() => setActiveSubTab('pokedex')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'pokedex' && styles.subTabTextActive,
            ]}
          >
            📖 Pokédex ({hatchedPokemon.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. SECTION INCUBATEURS & RÉSERVE D'OEUFS */}
      {activeSubTab === 'incubators' && (
        <View>
          <Text style={styles.sectionHeaderTitle}>Espaces d’Incubation</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            L’XP gagné à chaque entraînement fait éclore les œufs placés dans vos incubateurs !
          </Text>

          <View style={styles.slotsGrid}>
            {incubatorSlots.map((slot) => {
              const egg = slot.egg;
              const rarityConfig = egg ? EGG_RARITY_CONFIG[egg.rarity] : null;
              const progressPct = egg
                ? Math.min(100, Math.round((egg.current_xp / egg.required_xp) * 100))
                : 0;
              const xpRemaining = egg ? Math.max(0, egg.required_xp - egg.current_xp) : 0;

              return (
                <Card
                  key={slot.slot_number}
                  style={[
                    styles.slotCard,
                    !slot.is_unlocked && styles.slotCardLocked,
                    Boolean(egg) && styles.slotCardActive,
                  ]}
                >
                  <View style={styles.slotHeaderRow}>
                    <View style={styles.slotNumberBadge}>
                      <Text style={styles.slotNumberText}>#{slot.slot_number}</Text>
                    </View>
                    <Text style={styles.slotName} numberOfLines={1}>
                      {slot.name}
                    </Text>
                    {slot.is_unlocked ? (
                      <Text style={styles.slotUnlockedEmoji}>{slot.emoji}</Text>
                    ) : (
                      <Text style={styles.slotLockIcon}>🔒</Text>
                    )}
                  </View>

                  {/* État du Slot */}
                  {slot.is_unlocked ? (
                    egg ? (
                      /* Œuf en cours d'incubation */
                      <View style={styles.eggContainer}>
                        <View
                          style={[
                            styles.eggVisualBox,
                            { backgroundColor: rarityConfig?.bg || '#231B15' },
                          ]}
                        >
                          <Text style={styles.eggBigEmoji}>{rarityConfig?.emoji || '🥚'}</Text>
                          {egg.is_legendary === 1 && (
                            <View style={styles.legendaryStarPill}>
                              <Text style={styles.legendaryStarText}>⭐ LÉGENDAIRE</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.eggTitle} numberOfLines={1}>
                          {egg.name}
                        </Text>
                        <Text style={styles.eggOrigin} numberOfLines={1}>
                          {egg.obtained_from}
                        </Text>

                        {/* Barre de progression XP */}
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${progressPct}%`,
                                backgroundColor: rarityConfig?.color || Colors.primary,
                              },
                            ]}
                          />
                        </View>

                        <View style={styles.xpTextRow}>
                          <Text style={styles.xpProgressText}>
                            {egg.current_xp} / {egg.required_xp} XP
                          </Text>
                          <Text style={styles.xpPercentText}>{progressPct}%</Text>
                        </View>

                        <Text style={styles.remainingXpHint}>
                          Encore {xpRemaining} XP d’effort
                        </Text>

                        <TouchableOpacity
                          style={styles.retireBtn}
                          onPress={() => handleRemoveEgg(egg.id, egg.name)}
                        >
                          <Text style={styles.retireBtnText}>Retirer ↩</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* Slot débloqué mais vide */
                      <View style={styles.emptySlotBox}>
                        <Text style={styles.emptySlotEmoji}>🪹</Text>
                        <Text style={styles.emptySlotTitle}>Incubateur Libre</Text>
                        <Text style={styles.emptySlotSubtitle}>
                          Placez un œuf pour le faire progresser
                        </Text>
                        <Button
                          title="+ Placer un Œuf"
                          variant="primary"
                          size="sm"
                          onPress={() => handleOpenPickerForSlot(slot.slot_number)}
                          style={{ marginTop: 8 }}
                        />
                      </View>
                    )
                  ) : (
                    /* Slot verrouillé */
                    <View style={styles.lockedSlotBox}>
                      <Text style={styles.lockedSlotTitle}>Espace Verrouillé</Text>
                      <Text style={styles.lockedSlotDesc}>
                        Condition : {slot.unlock_condition}
                      </Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>

          {/* RÉSERVE D'OEUFS EN ATTENTE */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 20 }]}>
            Réserve d’Œufs ({inventoryEggs.length})
          </Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Vos œufs obtenus en récompense prêts à être placés dans un incubateur
          </Text>

          {inventoryEggs.length === 0 ? (
            <Card style={styles.emptyInventoryCard}>
              <Text style={styles.emptyInventoryEmoji}>🧺</Text>
              <Text style={styles.emptyInventoryTitle}>Aucun œuf en réserve</Text>
              <Text style={styles.emptyInventoryText}>
                Terminez des séances d’entraînement ou débloquez des Badges et Défis pour obtenir de nouveaux œufs !
              </Text>
            </Card>
          ) : (
            <View style={styles.inventoryList}>
              {inventoryEggs.map((egg) => {
                const config = EGG_RARITY_CONFIG[egg.rarity];
                return (
                  <Card key={egg.id} style={styles.inventoryEggCard}>
                    <View
                      style={[
                        styles.inventoryEggIconBox,
                        { backgroundColor: config.bg },
                      ]}
                    >
                      <Text style={styles.inventoryEggEmoji}>{config.emoji}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.inventoryEggHeaderRow}>
                        <Text style={styles.inventoryEggName}>{egg.name}</Text>
                        <View
                          style={[
                            styles.rarityPill,
                            { backgroundColor: config.color + '25' },
                          ]}
                        >
                          <Text
                            style={[styles.rarityPillText, { color: config.color }]}
                          >
                            {config.requiredXp} XP Requis
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.inventoryEggOrigin}>
                        Origine : {egg.obtained_from}
                      </Text>

                      {egg.is_legendary === 1 && (
                        <Text style={styles.legendaryPillInline}>
                          ⭐ Pokémon Légendaire
                        </Text>
                      )}
                    </View>

                    <Button
                      title="Incuber ❯"
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        const freeSlot = incubatorSlots.find(
                          (s) => s.is_unlocked && s.egg === null
                        );
                        if (freeSlot) {
                          placeEggInSlot(egg.id, freeSlot.slot_number).then(() =>
                            onRefreshData()
                          );
                        } else {
                          Alert.alert(
                            'Incubateurs complets',
                            'Tous vos incubateurs débloqués sont occupés. Attendez une éclosion ou retirez un œuf actif.'
                          );
                        }
                      }}
                      style={{ marginLeft: 8 }}
                    />
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 2. SECTION DÉFIS POKÉMON LÉGENDAIRES */}
      {activeSubTab === 'challenges' && (
        <View>
          <Text style={styles.sectionHeaderTitle}>Défis Légendaires de Kanto</Text>
          <Text style={styles.sectionSubtitle}>
            Accomplissez ces prouesses athlétiques exceptionnelles pour débloquer les 5 Pokémon Légendaires sacrés !
          </Text>

          <View style={styles.challengesList}>
            {legendaryChallenges.map((challenge) => {
              const existingHatched = hatchedPokemon.find(
                (p) => p.pokemon_id === challenge.speciesId
              );
              const existingEgg = [
                ...incubatingEggs,
                ...inventoryEggs,
              ].find((e) => e.pokemon_id === challenge.speciesId);

              const isCompleted = Boolean(existingHatched || existingEgg);

              return (
                <Card
                  key={challenge.id}
                  style={[
                    styles.legendaryCard,
                    isCompleted && styles.legendaryCardCompleted,
                  ]}
                >
                  <View style={styles.legendaryHeader}>
                    <View style={styles.legendaryIconBox}>
                      <Text style={styles.legendaryEmoji}>{challenge.emoji}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.legendaryTitleRow}>
                        <Text style={styles.legendaryName}>
                          {challenge.name}
                        </Text>
                        <Text style={styles.legendaryCpBadge}>
                          {challenge.cp}
                        </Text>
                      </View>
                      <Text style={styles.legendaryType}>
                        {challenge.type} • {challenge.challengeTitle}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.legendaryDesc}>{challenge.description}</Text>

                  <View style={styles.legendaryFooter}>
                    <View style={styles.reqPill}>
                      <Text style={styles.reqPillText}>🎯 {challenge.req}</Text>
                    </View>

                    {existingHatched ? (
                      <View style={styles.statusPillHatched}>
                        <Text style={styles.statusPillHatchedText}>✓ ÉCLOS DANS L’ÉQUIPE</Text>
                      </View>
                    ) : existingEgg ? (
                      <View style={styles.statusPillEgg}>
                        <Text style={styles.statusPillEggText}>
                          🥚 ŒUF DÉBLOQUÉ ({existingEgg.status === 'incubating' ? 'En incubation' : 'En réserve'})
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.statusPillLocked}>
                        <Text style={styles.statusPillLockedText}>🔒 DÉFI EN COURS</Text>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. SECTION POKÉDEX & POKÉMON ÉCLOS */}
      {activeSubTab === 'pokedex' && (
        <View>
          <Text style={styles.sectionHeaderTitle}>
            Pokédex de Musculation ({hatchedPokemon.length} Découverts)
          </Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Vos Pokémon nés de vos entraînements, classés par puissance de combat (CP)
          </Text>

          {hatchedPokemon.length === 0 ? (
            <Card style={styles.emptyInventoryCard}>
              <Text style={styles.emptyInventoryEmoji}>🥚</Text>
              <Text style={styles.emptyInventoryTitle}>Aucun Pokémon éclos pour l’instant</Text>
              <Text style={styles.emptyInventoryText}>
                Votre premier œuf de bienvenue est déjà dans l’Incubateur 1 ! Terminez une séance pour injecter vos premiers points d’XP et le faire éclore.
              </Text>
            </Card>
          ) : (
            <View style={styles.pokedexGrid}>
              {hatchedPokemon.map((poke) => (
                <TouchableOpacity
                  key={poke.id}
                  style={styles.pokedexCard}
                  onPress={() => setInspectPokemon(poke)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pokedexTopRow}>
                    <Text style={styles.pokedexCpText}>CP {poke.pokemon_cp}</Text>
                    {poke.is_legendary === 1 && (
                      <Text style={styles.pokedexLegendaryStar}>⭐</Text>
                    )}
                  </View>

                  <View style={styles.pokedexSpriteBox}>
                    <Text style={styles.pokedexSpriteEmoji}>
                      {poke.pokemon_emoji || '🐾'}
                    </Text>
                  </View>

                  <Text style={styles.pokedexName} numberOfLines={1}>
                    {poke.pokemon_name}
                  </Text>
                  <Text style={styles.pokedexType} numberOfLines={1}>
                    {poke.pokemon_type}
                  </Text>

                  <Text style={styles.pokedexHatchedDate}>
                    {poke.hatched_at
                      ? `Né le ${new Date(poke.hatched_at).toLocaleDateString('fr-FR')}`
                      : 'Né à l’effort'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* MODAL DE SÉLECTION D'OEUF POUR INCUBATEUR */}
      <Modal
        visible={eggPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEggPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Placer un Œuf dans l’Incubateur #{selectedSlotForPlacement}
              </Text>
              <TouchableOpacity
                onPress={() => setEggPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choisissez parmi les œufs disponibles dans votre réserve :
            </Text>

            {inventoryEggs.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🪹</Text>
                <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>
                  Aucun œuf en réserve disponible actuellement.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {inventoryEggs.map((egg) => {
                  const config = EGG_RARITY_CONFIG[egg.rarity];
                  return (
                    <TouchableOpacity
                      key={egg.id}
                      style={styles.pickerEggItem}
                      onPress={() => handlePlaceEgg(egg.id)}
                    >
                      <View
                        style={[
                          styles.pickerEggIconBox,
                          { backgroundColor: config.bg },
                        ]}
                      >
                        <Text style={styles.pickerEggEmoji}>{config.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerEggTitle}>{egg.name}</Text>
                        <Text style={styles.pickerEggMeta}>
                          {config.requiredXp} XP Requis • {egg.obtained_from}
                        </Text>
                      </View>
                      <Text style={styles.pickerEggAction}>Choisir ▶</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL D'INSPECTION DE POKÉMON ÉCLOS */}
      <Modal
        visible={Boolean(inspectPokemon)}
        transparent
        animationType="fade"
        onRequestClose={() => setInspectPokemon(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inspectCard}>
            <TouchableOpacity
              style={styles.inspectCloseBtn}
              onPress={() => setInspectPokemon(null)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.inspectEmojiCircle}>
              <Text style={styles.inspectEmoji}>
                {inspectPokemon?.pokemon_emoji || '🐾'}
              </Text>
            </View>

            <Text style={styles.inspectName}>{inspectPokemon?.pokemon_name}</Text>
            <View style={styles.inspectTypeBadge}>
              <Text style={styles.inspectTypeText}>{inspectPokemon?.pokemon_type}</Text>
            </View>

            <View style={styles.inspectCpBox}>
              <Text style={styles.inspectCpLabel}>PUISSANCE DE COMBAT</Text>
              <Text style={styles.inspectCpValue}>CP {inspectPokemon?.pokemon_cp}</Text>
            </View>

            <View style={styles.inspectOriginBox}>
              <Text style={styles.inspectOriginLabel}>Histoire & Origine :</Text>
              <Text style={styles.inspectOriginText}>
                Fait éclore grâce à vos entraînements Vitax ({inspectPokemon?.obtained_from}).
              </Text>
              {inspectPokemon?.is_legendary === 1 && (
                <View style={styles.legendaryPillLarge}>
                  <Text style={styles.legendaryPillLargeText}>
                    ⭐ POKÉMON LÉGENDAIRE DE KANTO
                  </Text>
                </View>
              )}
            </View>

            <Button
              title="Fermer"
              variant="secondary"
              size="md"
              onPress={() => setInspectPokemon(null)}
              style={{ width: '100%', marginTop: 16 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabButtonActive: {
    backgroundColor: Colors.primary,
  },
  subTabText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  sectionHeaderTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },
  sectionSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },
  slotsGrid: {
    gap: 12,
  },
  slotCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  slotCardActive: {
    borderColor: Colors.accent,
    backgroundColor: '#1B2436',
  },
  slotCardLocked: {
    opacity: 0.65,
    backgroundColor: '#151E2E',
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotNumberBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  slotNumberText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  slotName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  slotUnlockedEmoji: {
    fontSize: 18,
  },
  slotLockIcon: {
    fontSize: 14,
  },
  eggContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  eggVisualBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#475569',
  },
  eggBigEmoji: {
    fontSize: 34,
  },
  legendaryStarPill: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#EAB308',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  legendaryStarText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
  },
  eggTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eggOrigin: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  xpProgressText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  xpPercentText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  remainingXpHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  retireBtn: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  retireBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  emptySlotBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptySlotEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptySlotTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptySlotSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  lockedSlotBox: {
    paddingVertical: 10,
  },
  lockedSlotTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  lockedSlotDesc: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  emptyInventoryCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1E293B',
  },
  emptyInventoryEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyInventoryTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyInventoryText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  inventoryList: {
    gap: 10,
  },
  inventoryEggCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inventoryEggIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inventoryEggEmoji: {
    fontSize: 24,
  },
  inventoryEggHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inventoryEggName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rarityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inventoryEggOrigin: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  legendaryPillInline: {
    color: '#EAB308',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  challengesList: {
    gap: 12,
  },
  legendaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  legendaryCardCompleted: {
    borderColor: '#EAB308',
    backgroundColor: '#232018',
  },
  legendaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  legendaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D2817',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  legendaryEmoji: {
    fontSize: 26,
  },
  legendaryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendaryName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  legendaryCpBadge: {
    color: '#EAB308',
    fontSize: 14,
    fontWeight: '800',
  },
  legendaryType: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  legendaryDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  legendaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reqPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reqPillText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillHatched: {
    backgroundColor: '#065F46',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillHatchedText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillEgg: {
    backgroundColor: '#78350F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillEggText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillLocked: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillLockedText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  pokedexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pokedexCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pokedexTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  pokedexCpText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  pokedexLegendaryStar: {
    fontSize: 12,
  },
  pokedexSpriteBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pokedexSpriteEmoji: {
    fontSize: 32,
  },
  pokedexName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pokedexType: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  pokedexHatchedDate: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  pickerEggItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerEggIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerEggEmoji: {
    fontSize: 22,
  },
  pickerEggTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerEggMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pickerEggAction: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  inspectCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'center',
    width: '90%',
  },
  inspectCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 8,
  },
  inspectEmojiCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  inspectEmoji: {
    fontSize: 48,
  },
  inspectName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  inspectTypeBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  inspectTypeText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  inspectCpBox: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inspectCpLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  inspectCpValue: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  inspectOriginBox: {
    width: '100%',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
  },
  inspectOriginLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  inspectOriginText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  legendaryPillLarge: {
    backgroundColor: '#78350F',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  legendaryPillLargeText: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '800',
  },
});
