import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Button } from '../../common/Button';
import { PokemonEgg } from '../../../types';
import { arenaStyles as styles } from '../styles/arenaStyles';

interface CreateTradeModalProps {
  visible: boolean;
  tradablePokemon: PokemonEgg[];
  onClose: () => void;
  onSubmit: (pokemonEggId: string, criteria: string, friendsOnly: boolean) => Promise<boolean>;
}

const CreateTradeModalContent: React.FC<{
  tradablePokemon: PokemonEgg[];
  onClose: () => void;
  onSubmit: (pokemonEggId: string, criteria: string, friendsOnly: boolean) => Promise<boolean>;
}> = ({ tradablePokemon, onClose, onSubmit }) => {
  const [selectedMyPokemonId, setSelectedMyPokemonId] = useState<string>('');
  const [tradeCriteriaInput, setTradeCriteriaInput] = useState('');
  const [tradeFriendsOnly, setTradeFriendsOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMyPokemonId) {
      Alert.alert('Sélection requise', 'Veuillez choisir un Pokémon de votre collection à proposer.');
      return;
    }
    setLoading(true);
    const success = await onSubmit(
      selectedMyPokemonId,
      tradeCriteriaInput.trim(),
      tradeFriendsOnly
    );
    setLoading(false);
    if (success) {
      onClose();
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Proposer un Pokémon à l’Échange</Text>
        <Text style={styles.modalSub}>Choisissez parmi vos Pokémon éclos :</Text>

        <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
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
                    Type: {item.pokemon_type} • CP {item.pokemon_cp || 400}
                  </Text>
                </View>
                {isSelected && <Text style={{ color: Colors.primary, fontWeight: '900' }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.inputLabel, { marginTop: 4 }]}>Critère ou souhait (optionnel)</Text>
        <TextInput
          style={[styles.modalTextInput, { marginBottom: 10 }]}
          placeholder="Ex: Recherche Salamèche, Carapuce ou type Combat"
          placeholderTextColor={Colors.textMuted}
          value={tradeCriteriaInput}
          onChangeText={setTradeCriteriaInput}
        />

        {/* SWITCH : RÉSERVÉ AUX AMIS */}
        <View style={styles.friendsOnlySwitchRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.friendsOnlySwitchTitle}>🔒 Réservé à mes amis uniquement</Text>
            <Text style={styles.friendsOnlySwitchSub}>
              L’offre ne sera visible et échangeable que par vos amis ajoutés
            </Text>
          </View>
          <Switch
            value={tradeFriendsOnly}
            onValueChange={setTradeFriendsOnly}
            trackColor={{ false: '#263449', true: Colors.primary }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button
            title="Annuler"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Publication...' : 'Publier l’offre'}
            variant="primary"
            size="md"
            onPress={handleSubmit}
            disabled={loading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
};

export const CreateTradeModal: React.FC<CreateTradeModalProps> = ({
  visible,
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
      {visible ? (
        <CreateTradeModalContent
          tradablePokemon={tradablePokemon}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
};
