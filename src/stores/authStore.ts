import { create } from 'zustand';
import { AuthSession, TrainerProfile } from '../types/social';
import {
  getPersistedSession,
  restoreSessionSilently,
  loginTrainer,
  registerTrainer,
  logoutTrainer,
  onAuthStateChanged,
} from '../services/authService';

export interface AuthState {
  isInitialized: boolean;
  isLoggedIn: boolean;
  session: AuthSession | null;
  profile: TrainerProfile | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  register: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; profile?: TrainerProfile; error?: string }>;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; profile?: TrainerProfile; error?: string }>;
  logout: () => Promise<void>;
  setProfile: (profile: TrainerProfile | null) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isInitialized: false,
  isLoggedIn: false,
  session: null,
  profile: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      const profile = await restoreSessionSilently();
      const session = await getPersistedSession();
      const isLoggedIn = Boolean(session?.isLoggedIn && session?.userId);

      set({
        isInitialized: true,
        isLoggedIn,
        session: isLoggedIn ? session : null,
        profile: isLoggedIn ? profile : null,
        isLoading: false,
      });
    } catch (err: any) {
      console.warn('Erreur initialisation useAuthStore:', err);
      set({
        isInitialized: true,
        isLoggedIn: false,
        session: null,
        profile: null,
        isLoading: false,
        error: err?.message || null,
      });
    }
  },

  register: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await registerTrainer(username, password);
      if (res.success && res.profile) {
        const session = await getPersistedSession();
        set({
          isLoggedIn: true,
          session,
          profile: res.profile,
          isLoading: false,
          error: null,
        });
        return { success: true, profile: res.profile };
      } else {
        const err = res.error || 'Erreur lors de l’inscription';
        set({ isLoading: false, error: err });
        return { success: false, error: err };
      }
    } catch (err: any) {
      const errMessage = err?.message || 'Erreur lors de l’inscription';
      set({ isLoading: false, error: errMessage });
      return { success: false, error: errMessage };
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await loginTrainer(username, password);
      if (res.success && res.profile) {
        const session = await getPersistedSession();
        set({
          isLoggedIn: true,
          session,
          profile: res.profile,
          isLoading: false,
          error: null,
        });
        return { success: true, profile: res.profile };
      } else {
        const err = res.error || 'Identifiants incorrects';
        set({ isLoading: false, error: err });
        return { success: false, error: err };
      }
    } catch (err: any) {
      const errMessage = err?.message || 'Erreur lors de la connexion';
      set({ isLoading: false, error: errMessage });
      return { success: false, error: errMessage };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await logoutTrainer();
    } finally {
      set({
        isLoggedIn: false,
        session: null,
        profile: null,
        isLoading: false,
        error: null,
      });
    }
  },

  setProfile: (profile: TrainerProfile | null) => {
    set({ profile });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));

// Synchronisation réactive globale dès qu'une session change n'importe où dans l'application
onAuthStateChanged(async (session) => {
  if (session?.isLoggedIn && session.userId) {
    const current = useAuthStore.getState();
    if (!current.isLoggedIn || current.session?.userId !== session.userId) {
      useAuthStore.setState({
        isLoggedIn: true,
        session,
      });
    }
  } else {
    useAuthStore.setState({
      isLoggedIn: false,
      session: null,
      profile: null,
    });
  }
});
