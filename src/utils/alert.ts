import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Alerte universelle compatible iOS, Android et Web (PWA / Navigateur).
 * Sur React Native Web, Alert.alert ignore les boutons d'action personnalisés.
 * Cette fonction utilise window.confirm / window.alert sur le Web pour garantir
 * le déclenchement des callbacks de confirmation (suppression, déconnexion, etc.).
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as any);
    return;
  }

  // Comportement Web / PWA
  const fullText = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(fullText);
    }
    return;
  }

  if (buttons.length === 1) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(fullText);
    }
    if (buttons[0].onPress) {
      void buttons[0].onPress();
    }
    return;
  }

  // Deux boutons ou plus : identifier le bouton d'annulation et le bouton d'action principal
  const cancelBtn =
    buttons.find((b) => b.style === 'cancel') ||
    buttons.find((b) => /annuler|non|continuer|fermer|rester/i.test(b.text || ''));
  const confirmBtn =
    buttons.find((b) => b !== cancelBtn && b.style === 'destructive') ||
    buttons.find((b) => b !== cancelBtn) ||
    buttons[buttons.length - 1];

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const confirmed = window.confirm(fullText);
    if (confirmed) {
      if (confirmBtn?.onPress) {
        void confirmBtn.onPress();
      }
    } else {
      if (cancelBtn?.onPress) {
        void cancelBtn.onPress();
      }
    }
  } else if (confirmBtn?.onPress) {
    void confirmBtn.onPress();
  }
}
