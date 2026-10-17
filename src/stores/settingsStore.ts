import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPreferences, Equipment } from '../types';
import { EQUIPMENTS } from '../constants/muscles';

interface SettingsState extends UserPreferences {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setAvatarUrl: (url?: string) => Promise<void>;
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

async function persistAndSyncSettings(state: SettingsState): Promise<void> {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      user_name: state.user_name,
      avatar_url: state.avatar_url,
      user_height_cm: state.user_height_cm,
      available_equipments: state.available_equipments,
      filter_by_available_equipment: state.filter_by_available_equipment,
      default_rest_seconds: state.default_rest_seconds,
      haptic_enabled: state.haptic_enabled,
      sound_enabled: state.sound_enabled,
      weight_unit: state.weight_unit,
    })
  );
  try {
    const { syncUserSettingsToCloud } = await import('../services/cloudSyncService');
    void syncUserSettingsToCloud();
  } catch {}
  try {
    const { getOrCreateTrainerProfile, syncTrainerProfileToSupabase } = await import(
      '../services/multiplayer/profileService'
    );
    const prof = await getOrCreateTrainerProfile();
    prof.avatarUrl = state.avatar_url;
    if (state.user_name) prof.username = state.user_name;
    void syncTrainerProfileToSupabase(prof);
  } catch {}
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  user_name: '',
  avatar_url: undefined,
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
          avatar_url: parsed.avatar_url ?? undefined,
          user_height_cm: parsed.user_height_cm ?? undefined,
          available_equipments: Array.isArray(parsed.available_equipments)
            ? (parsed.available_equipments as Equipment[]).filter((eq) =>
                (EQUIPMENTS as string[]).includes(eq)
              )
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
    await persistAndSyncSettings(get());
  },

  setAvatarUrl: async (url?: string) => {
    set({ avatar_url: url });
    await persistAndSyncSettings(get());
  },

  setUserHeight: async (heightCm: number) => {
    const val = heightCm > 0 ? heightCm : undefined;
    set({ user_height_cm: val });
    await persistAndSyncSettings(get());
  },

  setAvailableEquipments: async (equipments: Equipment[]) => {
    set({ available_equipments: equipments });
    await persistAndSyncSettings(get());
  },

  toggleAvailableEquipment: async (equipment: Equipment) => {
    const current = get().available_equipments || [];
    const exists = current.includes(equipment);
    const updated = exists ? current.filter((eq) => eq !== equipment) : [...current, equipment];

    set({ available_equipments: updated });
    await persistAndSyncSettings(get());
  },

  setFilterByAvailableEquipment: async (enabled: boolean) => {
    set({ filter_by_available_equipment: enabled });
    await persistAndSyncSettings(get());
  },

  resetAvailableEquipments: async () => {
    set({ available_equipments: EQUIPMENTS, filter_by_available_equipment: true });
    await persistAndSyncSettings(get());
  },

  setDefaultRestSeconds: async (seconds: number) => {
    set({ default_rest_seconds: seconds });
    await persistAndSyncSettings(get());
  },

  setHapticEnabled: async (enabled: boolean) => {
    set({ haptic_enabled: enabled });
    await persistAndSyncSettings(get());
  },

  setSoundEnabled: async (enabled: boolean) => {
    set({ sound_enabled: enabled });
    await persistAndSyncSettings(get());
  },

  setWeightUnit: async (unit: 'kg' | 'lbs') => {
    set({ weight_unit: unit });
    await persistAndSyncSettings(get());
  },
}));
