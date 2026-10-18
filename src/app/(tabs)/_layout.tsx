import React from 'react';
import { router, Tabs } from 'expo-router';
import { Text, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';


export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Dégagement inférieur équilibré sans écraser le contenu
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const tabHeight = 62 + safeBottom;

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
          backgroundColor: Colors.background,
          borderTopColor: Colors.surfaceBorder,
          borderTopWidth: 1.5,
          height: tabHeight,
          paddingBottom: safeBottom,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          headerTitle: 'VITAX MUSCULATION',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24, lineHeight: 28, textAlign: 'center', opacity: focused ? 1 : 0.6 }}>
              🏋️
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Progression',
          headerTitle: 'SUIVI DE PROGRESSION',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24, lineHeight: 28, textAlign: 'center', opacity: focused ? 1 : 0.6 }}>
              📈
            </Text>
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate('/(tabs)')}
              style={{ paddingHorizontal: 16 }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 16, color: Colors.primary, fontWeight: '800' }}>❮ Accueil</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          headerTitle: 'PARAMÈTRES',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24, lineHeight: 28, textAlign: 'center', opacity: focused ? 1 : 0.6 }}>
              ⚙️
            </Text>
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate('/(tabs)')}
              style={{ paddingHorizontal: 16 }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ fontSize: 16, color: Colors.primary, fontWeight: '800' }}>❮ Accueil</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}



