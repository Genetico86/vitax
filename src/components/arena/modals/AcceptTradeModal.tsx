import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { PokemonEgg } from '../../../types';
import { PokemonTradeOffer } from '../../../types/social';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface AcceptTradeModalProps {
  visible: boolean;
  offer: PokemonTradeOffer | null;
  tradablePokemon: PokemonEgg[];
  onClose: () => void;
  onSubmit: (offerId: string, myPokemonId: string) => Promise<boolean>;
}

const AcceptTradeModalContent: React.FC<{
  offer: PokemonTradeOffer;
  tradablePokemon: PokemonEgg[];
  onClose: () => void;
  onSubmit: (offerId: string, myPokemonId: string) => Promise<boolean>;
}> = ({ offer, tradablePokemon, onClose, onSubmit }) => {
  const [selectedMyPokemonId, setSelectedMyPokemonId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedMyPokemonId) {
      Alert.alert('Sélection requise', 'Veuillez choisir le Pokémon que vous offrez en contrepartie.');
      return;
    }
    setLoading(true);
    const success = await onSubmit(offer.id, selectedMyPokemonId);
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Conclure l’Échange 🤝</Text>
        <Text style={styles.modalSub}>
          Vous allez recevoir :{' '}
          <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
            {offer.offeredPokemon.name}{' '}
            {offer.offeredPokemon.emoji}
          </Text>
        </Text>
        <Text style={[styles.modalSub, { marginTop: 8 }]}>
          Sélectionnez le Pokémon que vous donnez en retour :
        </Text>

        <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
          {tradablePokemon.map((item) => {
            const isSelected = selectedMyPokemonId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.modalSelectItem, isSelected && styles.modalSelectItemActive]}
                onPress={() => setSelectedMyPokemonId(item.id)}
              >
                <Text style={{ fontSize: 26, marginRight: 10 }}>{item.pokemon_emoji || '🥚'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.pokemon_name}</Text>
                  <Text style={styles.modalItemSub}>
                    CP {item.pokemon_cp || 400} • {item.pokemon_type}
                  </Text>
                </View>
                {isSelected && <Text style={{ color: Colors.primary, fontWeight: '900' }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button
            title="Annuler"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Validation...' : 'Confirmer l’échange'}
            variant="primary"
            size="md"
            onPress={handleConfirm}
            disabled={loading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
};

export const AcceptTradeModal: React.FC<AcceptTradeModalProps> = ({
  visible,
  offer,
  tradablePokemon,
  onClose,
  onSubmit,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible && offer ? (
        <AcceptTradeModalContent
          offer={offer}
          tradablePokemon={tradablePokemon}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
