import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../database/db';
import { useSettingsStore } from '../stores/settingsStore';
import { restoreSessionSilently } from '../services/authService';
import { Colors } from '../constants/colors';
import * as Updates from 'expo-updates';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        await loadSettings();
        await restoreSessionSilently();
        setIsReady(true);

        // Vérification automatique et transparente des mises à jour OTA en arrière-plan
        if (Updates.isEnabled && !__DEV__) {
          try {
            const check = await Updates.checkForUpdateAsync();
            if (check.isAvailable) {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            }
          } catch {
            // Silencieux si hors-ligne
          }
        }
      } catch (err: any) {
        console.error('Erreur initialisation Vitax:', err);
        setInitError(err.message || 'Erreur d’initialisation');
        setIsReady(true);
      }
    }

    setup();
  }, [loadSettings]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Vitax Musculation</Text>
        <Text style={styles.loadingSub}>Initialisation 100% hors-ligne...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: Colors.danger }]}>Erreur d’initialisation</Text>
        <Text style={styles.loadingSub}>{initError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/active"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="workout/summary"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="programs/[id]"
          options={{
            title: 'Détails du programme',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="programs/create"
          options={{
            title: 'Créer un programme',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="programs/target-muscle"
          options={{
            title: 'Ciblage Musculaire',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="exercises/index"
          options={{
            title: 'Catalogue d’exercices',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="exercises/create"
          options={{
            title: 'Nouvel exercice',
            headerBackTitle: 'Retour',
          }}
        />
        <Stack.Screen
          name="arena/index"
          options={{
            title: 'Arène Vitax',
            headerBackTitle: 'Retour',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loadingSub: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
