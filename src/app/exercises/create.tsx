import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { createCustomExercise } from '../../database/exerciseRepository';
import { MUSCLE_GROUPS, EQUIPMENTS } from '../../constants/muscles';
import { MuscleGroup, Equipment } from '../../types';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export default function CreateExerciseScreen() {
  const [name, setName] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>('Pectoraux');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('Haltères');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Veuillez saisir le nom de l’exercice.');
      return;
    }

    setLoading(true);
    try {
      await createCustomExercise({
        name: name.trim(),
        target_muscle: selectedMuscle,
        equipment_needed: selectedEquipment,
        description: description.trim(),
      });

      Alert.alert('Succès', 'Exercice ajouté au catalogue !', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d’enregistrer l’exercice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Input
          label="Nom de l’exercice"
          placeholder="Ex: Hip Thrust à la barre"
          value={name}
          onChangeText={setName}
        />

        {/* Groupe musculaire */}
        <Text style={styles.label}>Groupe musculaire ciblé</Text>
        <View style={styles.chipsContainer}>
          {MUSCLE_GROUPS.map((m) => {
            const isSelected = selectedMuscle === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedMuscle(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Équipement nécessaire */}
        <Text style={[styles.label, { marginTop: 14 }]}>Matériel nécessaire</Text>
        <View style={styles.chipsContainer}>
          {EQUIPMENTS.map((eq) => {
            const isSelected = selectedEquipment === eq;
            return (
              <TouchableOpacity
                key={eq}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedEquipment(eq)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {eq}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Instructions / Conseils d’exécution"
          placeholder="Ex: Pieds calés, dos en appui, contracter les fessiers au sommet..."
          value={description}
          onChangeText={setDescription}
          multiline
          containerStyle={{ marginTop: 16 }}
        />

        <Button
          title="Ajouter au catalogue"
          variant="primary"
          size="lg"
          onPress={handleSave}
          loading={loading}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#162235',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24344E',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
