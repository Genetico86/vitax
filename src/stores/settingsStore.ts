import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPreferences, Equipment } from '../types';
import { EQUIPMENTS } from '../constants/muscles';

interface SettingsState extends UserPreferences {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setUserHeight: (heightCm: number) => Promise<void>;
  setAvailableEquipments: (equipments: Equipment[]) => Promise<void>;
  toggleAvailableEquipment: (equipment: Equipment) => Promise<void>;
  setFilterByAvailableEquipment: (enabled: boolean) => Promise<void>;
  resetAvailableEquipments: () => Promise<void>;
  setDefaultRestSeconds: (seconds: number) => Promise<void>;
  setHapticEnabled: (enabled: boolean) => Promise<void>;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setWeightUnit: (unit: 'kg' | 'lbs') => Promise<void>;
}

const SETTINGS_KEY = '@vitax_user_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  user_name: '',
  user_height_cm: undefined,
  available_equipments: EQUIPMENTS,
  filter_by_available_equipment: true,
  default_rest_seconds: 90,
  haptic_enabled: true,
  sound_enabled: true,
  weight_unit: 'kg',
  isLoaded: false,

  loadSettings: async () => {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        set({
          user_name: parsed.user_name ?? '',
          user_height_cm: parsed.user_height_cm ?? undefined,
          available_equipments: Array.isArray(parsed.available_equipments)
            ? (parsed.available_equipments as Equipment[])
            : EQUIPMENTS,
          filter_by_available_equipment: parsed.filter_by_available_equipment ?? true,
          default_rest_seconds: parsed.default_rest_seconds ?? 90,
          haptic_enabled: parsed.haptic_enabled ?? true,
          sound_enabled: parsed.sound_enabled ?? true,
          weight_unit: parsed.weight_unit ?? 'kg',
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setUserName: async (name: string) => {
    const trimmed = name.trim();
    set({ user_name: trimmed });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: trimmed,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setUserHeight: async (heightCm: number) => {
    const val = heightCm > 0 ? heightCm : undefined;
    set({ user_height_cm: val });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: val,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setAvailableEquipments: async (equipments: Equipment[]) => {
    set({ available_equipments: equipments });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  toggleAvailableEquipment: async (equipment: Equipment) => {
    const current = get().available_equipments || [];
    const exists = current.includes(equipment);
    const updated = exists ? current.filter((eq) => eq !== equipment) : [...current, equipment];

    set({ available_equipments: updated });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: updated,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setFilterByAvailableEquipment: async (enabled: boolean) => {
    set({ filter_by_available_equipment: enabled });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: enabled,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  resetAvailableEquipments: async () => {
    set({ available_equipments: EQUIPMENTS, filter_by_available_equipment: true });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: EQUIPMENTS,
        filter_by_available_equipment: true,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setDefaultRestSeconds: async (seconds: number) => {
    set({ default_rest_seconds: seconds });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setHapticEnabled: async (enabled: boolean) => {
    set({ haptic_enabled: enabled });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setSoundEnabled: async (enabled: boolean) => {
    set({ sound_enabled: enabled });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: enabled,
        weight_unit: get().weight_unit,
      })
    );
  },

  setWeightUnit: async (unit: 'kg' | 'lbs') => {
    set({ weight_unit: unit });
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        user_name: get().user_name,
        user_height_cm: get().user_height_cm,
        available_equipments: get().available_equipments,
        filter_by_available_equipment: get().filter_by_available_equipment,
        default_rest_seconds: get().default_rest_seconds,
        haptic_enabled: get().haptic_enabled,
        sound_enabled: get().sound_enabled,
        weight_unit: unit,
      })
    );
  },
}));
