import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
      <Text style={[styles.iconText, focused && styles.iconFocused]}>{icon}</Text>
      <Text style={[styles.labelText, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Dégagement inférieur robuste garantissant que les onglets ne chevauchent jamais
  // les boutons de navigation système du téléphone (Retour / Accueil / Récents) ni la barre gestuelle
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 24);
  const tabHeight = 58 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
          borderBottomWidth: 1,
          borderBottomColor: Colors.surfaceBorder,
        },
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: '800',
          fontSize: 20,
        },
        tabBarStyle: {
          backgroundColor: '#090E1A',
          borderTopColor: '#1A2538',
          borderTopWidth: 1.5,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Programmes',
          headerTitle: 'VITAX MUSCULATION',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏋️" label="Programmes" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          headerTitle: 'HISTORIQUE & PROGRÈS',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📈" label="Historique" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          headerTitle: 'PARAMÈTRES',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="⚙️" label="Paramètres" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 82,
  },
  iconContainerFocused: {
    backgroundColor: 'rgba(255, 90, 31, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 31, 0.28)',
  },
  iconText: {
    fontSize: 22,
    opacity: 0.65,
  },
  iconFocused: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  labelFocused: {
    color: Colors.primary,
    fontWeight: '800',
  },
});

