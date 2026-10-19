import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';

export const MandatoryAuthScreen: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { register, login, isLoading, error: storeError, setError } = useAuthStore();

  const handleModeSwitch = (registerMode: boolean) => {
    setIsRegisterMode(registerMode);
    setLocalError(null);
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 2) {
      setLocalError('Le nom d’utilisateur doit comporter au moins 2 caractères.');
      return;
    }

    if (!password || password.length < 4) {
      setLocalError('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setLocalError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setLocalError(null);
    setError(null);

    if (isRegisterMode) {
      await register(trimmedUsername, password);
    } else {
      await login(trimmedUsername, password);
    }
  };

  const activeError = localError || storeError;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <Text style={styles.title}>VITAX</Text>
            <Text style={styles.tagline}>Musculation & Performance Connectée</Text>

            {/* Badge étape obligatoire */}
            <View style={styles.mandatoryBadge}>
              <Text style={styles.mandatoryBadgeDot}>●</Text>
              <Text style={styles.mandatoryBadgeText}>Étape obligatoire pour utiliser l’application</Text>
            </View>
            <Text style={styles.mandatorySubtitle}>
              {isRegisterMode
                ? 'Pour synchroniser vos séances, vos charges et vos records en temps réel sur le cloud, créez votre profil athlète.'
                : 'Connectez-vous à votre compte pour retrouver vos séances, vos programmes et votre progression.'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Mode Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabButton, isRegisterMode && styles.tabButtonActive]}
                onPress={() => handleModeSwitch(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.tabButtonText, isRegisterMode && styles.tabButtonTextActive]}
                >
                  👤 S’enregistrer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, !isRegisterMode && styles.tabButtonActive]}
                onPress={() => handleModeSwitch(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.tabButtonText, !isRegisterMode && styles.tabButtonTextActive]}
                >
                  🔑 Se connecter
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Alert */}
            {activeError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{activeError}</Text>
              </View>
            )}

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nom d’utilisateur / Pseudo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Alex, Sarah, Lucas..."
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (activeError) {
                    setLocalError(null);
                    setError(null);
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={25}
                returnKeyType="next"
              />
              <Text style={styles.inputHelper}>
                Au moins 2 caractères • Identifiant unique dans l’Arène
              </Text>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? 'Masquer 🙈' : 'Afficher 👁️'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (activeError) {
                    setLocalError(null);
                    setError(null);
                  }
                }}
                returnKeyType={isRegisterMode ? 'next' : 'done'}
                onSubmitEditing={() => {
                  if (!isRegisterMode) {
                    handleSubmit();
                  }
                }}
              />
              <Text style={styles.inputHelper}>
                Au moins 4 caractères • Condensat PBKDF2 sécurisé
              </Text>
            </View>

            {/* Confirm Password (only in registration mode) */}
            {isRegisterMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Répétez votre mot de passe"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (activeError) {
                      setLocalError(null);
                      setError(null);
                    }
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitButtonText}>
                    {isRegisterMode ? 'Création de votre compte...' : 'Connexion en cours...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {isRegisterMode ? 'Créer mon profil Athlète ❯' : 'Accéder à mon compte ❯'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch Mode Link */}
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => handleModeSwitch(!isRegisterMode)}
              activeOpacity={0.7}
            >
              <Text style={styles.switchModeText}>
                {isRegisterMode ? (
                  <>
                    Déjà un compte ?{' '}
                    <Text style={styles.switchModeHighlight}>Connectez-vous ici</Text>
                  </>
                ) : (
                  <>
                    Pas encore de compte ?{' '}
                    <Text style={styles.switchModeHighlight}>Enregistrez-vous ici</Text>
                  </>
                )}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features Highlights */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>Pourquoi l’enregistrement est obligatoire ?</Text>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>☁️</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureHeading}>Sauvegarde Cloud en temps réel</Text>
                <Text style={styles.featureDescription}>
                  Ne perdez jamais vos séances, historiques de séries et charges d’entraînement.
                </Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>🏆</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureHeading}>Arène & Classements Hebdomadaires</Text>
                <Text style={styles.featureDescription}>
                  Gagnez de l’XP à chaque répétition, grimpez les ligues et défiez vos amis.
                </Text>
              </View>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureEmoji}>📊</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={styles.featureHeading}>Records Personnels & Statistiques</Text>
                <Text style={styles.featureDescription}>
                  Calcul automatique de vos 1RM, volume total et suivi complet de votre progression.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 99999,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 32 : 48,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    maxWidth: 440,
    width: '100%',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 34,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.18)',
    borderColor: 'rgba(255, 45, 85, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  mandatoryBadgeDot: {
    color: Colors.primary,
    fontSize: 10,
    marginRight: 6,
  },
  mandatoryBadgeText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  mandatorySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 22,
    marginBottom: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tabButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerBackground,
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dangerLight,
    lineHeight: 18,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  showPasswordText: {
    fontSize: 12,
    color: Colors.accentLight,
    fontWeight: '700',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  inputHelper: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 5,
    marginLeft: 2,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  switchModeHighlight: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  featuresCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
  },
  featuresTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureEmoji: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
