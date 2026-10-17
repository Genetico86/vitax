import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../database/db';
import { useSettingsStore } from '../stores/settingsStore';
import { restoreSessionSilently } from '../services/authService';
import { Colors } from '../constants/colors';
import { FriendInviteNotificationBanner } from '../components/social/FriendInviteNotificationBanner';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    let isCancelled = false;
    let cleanupRealtime = () => {};

    // Chien de garde (watchdog) : garantit que l'écran de chargement ne reste jamais bloqué plus de 2.5s
    const watchdog = setTimeout(() => {
      if (!isCancelled) {
        setIsReady(true);
      }
    }, 2500);

    async function setup() {
      try {
        await initDatabase();
        await loadSettings();
        await restoreSessionSilently();

        // Restauration automatique d'une séance en cours si l'application avait été fermée
        try {
          const { useWorkoutSessionStore } = await import('../stores/workoutSessionStore');
          await useWorkoutSessionStore.getState().restoreActiveWorkoutIfAny();
        } catch {}

        // Le stockage local et la session sont initialisés : ouverture immédiate de l'interface
        if (!isCancelled) {
          setIsReady(true);
        }

        // Synchronisation temps réel avec Supabase en tâche de fond (non-bloquante)
        try {
          const { syncCloudAndLocal, registerRealtimeLifecycleSync } = await import(
            '../services/cloudSyncService'
          );
          cleanupRealtime = registerRealtimeLifecycleSync();
          void syncCloudAndLocal().catch((syncErr) => {
            console.warn('Sync cloud initial en arrière-plan:', syncErr);
          });
        } catch (syncErr) {
          console.warn('Sync cloud initial:', syncErr);
        }

      } catch (err: any) {
        console.error('Erreur initialisation Vitax:', err);
        if (!isCancelled) {
          setInitError(err.message || 'Erreur d’initialisation');
          setIsReady(true);
        }
      }
    }

    void setup();

    return () => {
      isCancelled = true;
      clearTimeout(watchdog);
      cleanupRealtime();
    };
  }, [loadSettings, retryKey]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Vitax Musculation</Text>
        <Text style={styles.loadingSub}>Synchronisation Cloud Supabase en temps réel...</Text>
      </View>
    );
  }

  if (initError) {
    const isWebLockError =
      initError.includes('NoModificationAllowed') ||
      initError.includes('Access Handles') ||
      initError.includes('createSyncAccessHandle');

    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>⚠️</Text>
        <Text style={[styles.loadingText, { color: Colors.danger, textAlign: 'center' }]}>
          {isWebLockError ? 'Onglet Chrome déjà ouvert' : 'Erreur d’initialisation'}
        </Text>
        <Text style={[styles.loadingSub, { textAlign: 'center', marginHorizontal: 24, marginTop: 8, lineHeight: 22 }]}>
          {isWebLockError
            ? 'Vitax est déjà actif dans un autre onglet ou fenêtre de votre navigateur Chrome. Le stockage local sécurisé interdit les accès simultanés.\n\nFermez l’autre onglet Vitax dans Chrome, puis cliquez sur Réessayer ci-dessous.'
            : initError}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.reload();
            } else {
              setIsReady(false);
              setInitError(null);
              setRetryKey((k) => k + 1);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>🔄 Réessayer</Text>
        </TouchableOpacity>
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
          name="workout/ai-generator"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="running/index"
          options={{
            headerShown: false,
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
      <FriendInviteNotificationBanner />
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
  retryButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryButtonText: {
    color: Colors.primaryText,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
