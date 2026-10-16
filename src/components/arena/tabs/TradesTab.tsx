import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { Button } from '../../common/Button';
import { PokemonEgg } from '../../../types';
import { PokemonTradeOffer } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';
import { TradeFilter } from '../hooks/useArenaData';

interface TradesTabProps {
  tradablePokemon: PokemonEgg[];
  tradeOffers: PokemonTradeOffer[];
  tradeFilter: TradeFilter;
  onFilterChange: (filter: TradeFilter) => void;
  onOpenCreateOffer: () => void;
  onAcceptOffer: (offer: PokemonTradeOffer) => void;
}

export const TradesTab: React.FC<TradesTabProps> = ({
  tradablePokemon,
  tradeOffers,
  tradeFilter,
  onFilterChange,
  onOpenCreateOffer,
  onAcceptOffer,
}) => {
  return (
    <View>
      <View style={styles.tradeHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeaderTitle}>Centre d’Échange Pokémon 🔄</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Échangez vos Pokémon débloqués avec d’autres dresseurs
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newTradeBtn}
          onPress={onOpenCreateOffer}
          activeOpacity={0.8}
        >
          <Text style={styles.newTradeBtnText}>+ Proposer</Text>
        </TouchableOpacity>
      </View>

      {/* FILTRE : TOUTES LES OFFRES VS OFFRES D'AMIS */}
      <View style={[styles.filterSegmentContainer, { marginBottom: 14 }]}>
        <TouchableOpacity
          style={[
            styles.filterSegmentBtn,
            tradeFilter === 'all' && styles.filterSegmentBtnActive,
          ]}
          onPress={() => onFilterChange('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterSegmentText,
              tradeFilter === 'all' && styles.filterSegmentTextActive,
            ]}
          >
            🌍 Toutes les offres
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterSegmentBtn,
            tradeFilter === 'friends' && styles.filterSegmentBtnActive,
          ]}
          onPress={() => onFilterChange('friends')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.filterSegmentText,
              tradeFilter === 'friends' && styles.filterSegmentTextActive,
            ]}
          >
            👥 Offres d’amis
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mes Pokémon Échangeables */}
      <Card style={styles.myTradablesCard}>
        <Text style={styles.myTradablesTitle}>
          Vos Pokémon Disponibles ({tradablePokemon.length})
        </Text>
        {tradablePokemon.length === 0 ? (
          <Text style={styles.emptyNote}>
            Faites éclore des œufs d’entraînement pour obtenir des Pokémon échangeables.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 8 }}
          >
            {tradablePokemon.map((p) => (
              <View key={p.id} style={styles.tradableChip}>
                <Text style={{ fontSize: 22 }}>{p.pokemon_emoji || '🥚'}</Text>
                <Text style={styles.tradableName} numberOfLines={1}>
                  {p.pokemon_name}
                </Text>
                <Text style={styles.tradableCp}>CP {p.pokemon_cp || 400}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Card>

      {/* Offres disponibles */}
      <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>
        {tradeFilter === 'friends'
          ? `Offres de votre cercle d’amis (${tradeOffers.length})`
          : `Toutes les offres de l’Arène (${tradeOffers.length})`}
      </Text>

      {tradeOffers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 30, textAlign: 'center', marginBottom: 6 }}>🔄</Text>
          <Text style={styles.emptyCardTitle}>Aucune offre disponible</Text>
          <Text style={styles.emptyCardSub}>
            {tradeFilter === 'friends'
              ? 'Aucun de vos amis n’a publié d’offre pour le moment. Proposez-leur un échange !'
              : 'Soyez le premier à proposer un Pokémon à l’échange !'}
          </Text>
        </Card>
      ) : (
        tradeOffers.map((offer) => {
          const isCompleted = offer.status === 'completed';
          return (
            <Card
              key={offer.id}
              style={[styles.offerCard, isCompleted && styles.offerCardCompleted]}
            >
              <View style={styles.offerTopRow}>
                <View style={styles.offerPokemonBox}>
                  <Text style={{ fontSize: 32 }}>{offer.offeredPokemon.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={styles.offerPokemonName}>{offer.offeredPokemon.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {offer.friendsOnly && (
                        <Badge
                          label="👥 Amis"
                          color="rgba(245, 158, 11, 0.15)"
                          textColor="#FBBF24"
                        />
                      )}
                      <Badge
                        label={`CP ${offer.offeredPokemon.cp}`}
                        color="rgba(59, 130, 246, 0.15)"
                        textColor="#60A5FA"
                      />
                    </View>
                  </View>
                  <Text style={styles.offerType}>Type : {offer.offeredPokemon.type}</Text>
                  <Text style={styles.offerTrainer}>
                    Proposé par{' '}
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                      {offer.senderName} ({offer.senderCode})
                    </Text>
                  </Text>
                </View>
              </View>

              {offer.requestedCriteriaText && (
                <View style={styles.criteriaBox}>
                  <Text style={styles.criteriaText}>
                    💡 Souhait : {offer.requestedCriteriaText}
                  </Text>
                </View>
              )}

              <View style={styles.offerBottomRow}>
                {isCompleted ? (
                  <Text style={styles.completedBadgeText}>✓ Échange conclu</Text>
                ) : (
                  <Button
                    title="Échanger avec ce Pokémon 🤝"
                    size="sm"
                    variant="primary"
                    onPress={() => onAcceptOffer(offer)}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
};
