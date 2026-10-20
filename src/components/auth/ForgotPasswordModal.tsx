import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../utils/alert';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type RecoveryMethod = 'email' | 'rescue';

const ForgotPasswordModalContent: React.FC<ForgotPasswordModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [method, setMethod] = useState<RecoveryMethod>('email');

  // Mode Email - Étape 1 & 2
  const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [emailNewPassword, setEmailNewPassword] = useState('');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');

  // Mode Clé de secours (Code Ami)
  const [rescueUsername, setRescueUsername] = useState('');
  const [rescueFriendCode, setRescueFriendCode] = useState('');
  const [rescueEmail, setRescueEmail] = useState('');
  const [rescueNewPassword, setRescueNewPassword] = useState('');
  const [rescueConfirmPassword, setRescueConfirmPassword] = useState('');

  // États communs
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const { requestPasswordReset, resetPasswordWithCode, resetPasswordWithRescueCode } =
    useAuthStore();

  const handleResetState = () => {
    setMethod('email');
    setEmailStep('request');
    setEmailIdentifier('');
    setMaskedEmail(null);
    setResetCode('');
    setEmailNewPassword('');
    setEmailConfirmPassword('');
    setRescueUsername('');
    setRescueFriendCode('');
    setRescueEmail('');
    setRescueNewPassword('');
    setRescueConfirmPassword('');
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(false);
  };

  const handleClose = () => {
    handleResetState();
    onClose();
  };

  // 1. Demande de réinitialisation par e-mail
  const handleRequestEmailCode = async () => {
    const ident = emailIdentifier.trim();
    if (!ident) {
      setErrorMsg('Veuillez saisir votre nom d’utilisateur ou votre adresse e-mail.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const res = await requestPasswordReset(ident);
    setLoading(false);

    if (res.success) {
      if (res.hasEmail) {
        setMaskedEmail(res.maskedEmail || null);
        setEmailStep('verify');
        if (res.code) {
          setInfoMsg(`Code de test/démo généré : ${res.code} (valable 15 min).`);
        } else {
          setInfoMsg('Un code de réinitialisation vous a été envoyé.');
        }
      } else {
        // Le compte n'a pas encore d'e-mail : bascule automatique vers le mode Clé de secours
        setMethod('rescue');
        setRescueUsername(ident);
        setErrorMsg(
          'Ce compte ne possède pas encore d’adresse e-mail associée. Utilisez votre Code Ami (5 chiffres) pour le réinitialiser.'
        );
      }
    } else {
      setErrorMsg(res.error || 'Compte introuvable.');
    }
  };

  // 2. Validation du code et changement de mot de passe (Mode Email)
  const handleVerifyEmailCode = async () => {
    const code = resetCode.trim();
    const newPass = emailNewPassword.trim();
    const confPass = emailConfirmPassword.trim();

    if (!code) {
      setErrorMsg('Veuillez renseigner le code à 6 chiffres.');
      return;
    }
    if (!newPass || newPass.length < 4) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 4 caractères.');
      return;
    }
    if (newPass !== confPass) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await resetPasswordWithCode(emailIdentifier.trim(), code, newPass);
    setLoading(false);

    if (res.success) {
      handleClose();
      showAlert(
        'Mot de passe réinitialisé 🎉',
        'Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.'
      );
      onSuccess?.();
    } else {
      setErrorMsg(res.error || 'Code invalide ou expiré.');
    }
  };

  // 3. Réinitialisation par Clé de secours (Code Ami Athlète)
  const handleRescueReset = async () => {
    const u = rescueUsername.trim();
    const fc = rescueFriendCode.trim();
    const em = rescueEmail.trim();
    const newPass = rescueNewPassword.trim();
    const confPass = rescueConfirmPassword.trim();

    if (!u) {
      setErrorMsg('Veuillez saisir votre nom d’utilisateur.');
      return;
    }
    if (!fc || !/^\d{5}$/.test(fc)) {
      setErrorMsg('Le Code Ami Athlète doit comporter exactement 5 chiffres.');
      return;
    }
    if (em) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(em)) {
        setErrorMsg('Format d’adresse e-mail invalide.');
        return;
      }
    }
    if (!newPass || newPass.length < 4) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 4 caractères.');
      return;
    }
    if (newPass !== confPass) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await resetPasswordWithRescueCode(u, fc, newPass, em || undefined);
    setLoading(false);

    if (res.success) {
      handleClose();
      showAlert(
        'Mot de passe réinitialisé 🎉',
        'Votre mot de passe a été mis à jour avec succès via votre Clé de secours. Vous pouvez vous connecter.'
      );
      onSuccess?.();
    } else {
      setErrorMsg(res.error || 'Erreur lors de la réinitialisation.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🔐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Récupération d’accès</Text>
              <Text style={styles.subtitle}>Réinitialisez votre mot de passe athlète</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Onglets de méthode de récupération */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, method === 'email' && styles.tabBtnActive]}
              onPress={() => {
                setMethod('email');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, method === 'email' && styles.tabBtnTextActive]}>
                ✉️ Par E-mail
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, method === 'rescue' && styles.tabBtnActive]}
              onPress={() => {
                setMethod('rescue');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, method === 'rescue' && styles.tabBtnTextActive]}>
                🛡️ Clé de secours
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications d'erreur ou d'information */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {infoMsg && (
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>{infoMsg}</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* ================= METHODE 1 : PAR EMAIL ================= */}
            {method === 'email' && (
              <>
                {emailStep === 'request' ? (
                  <View style={styles.stepContainer}>
                    <Text style={styles.sectionHelp}>
                      Saisissez votre pseudo ou votre adresse e-mail. Si un e-mail est associé à votre compte, vous recevrez un code de réinitialisation.
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Pseudo ou Adresse e-mail</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: alex ou alex@exemple.com"
                        placeholderTextColor={Colors.textMuted}
                        value={emailIdentifier}
                        onChangeText={(t) => {
                          setEmailIdentifier(t);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handleRequestEmailCode}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                      onPress={handleRequestEmailCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitBtnText}>Envoyer le code de réinitialisation ❯</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.stepContainer}>
                    <Text style={styles.sectionHelp}>
                      Code envoyé {maskedEmail ? `à l’adresse ${maskedEmail}` : ''}. Saisissez-le ci-dessous avec votre nouveau mot de passe.
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Code de confirmation (6 chiffres)</Text>
                      <TextInput
                        style={[styles.input, styles.codeInput]}
                        placeholder="123456"
                        placeholderTextColor={Colors.textMuted}
                        value={resetCode}
                        onChangeText={(t) => {
                          setResetCode(t);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={styles.labelRow}>
                        <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
                        <TouchableOpacity
                          onPress={() => setShowPassword((p) => !p)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.toggleText}>
                            {showPassword ? 'Masquer 🙈' : 'Afficher 👁️'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={Colors.textMuted}
                        secureTextEntry={!showPassword}
                        value={emailNewPassword}
                        onChangeText={(t) => {
                          setEmailNewPassword(t);
                          if (errorMsg) setErrorMsg(null);
                        }}
                      />
                      <Text style={styles.helperText}>Minimum 4 caractères</Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Confirmer le nouveau mot de passe</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={Colors.textMuted}
                        secureTextEntry={!showPassword}
                        value={emailConfirmPassword}
                        onChangeText={(t) => {
                          setEmailConfirmPassword(t);
                          if (errorMsg) setErrorMsg(null);
                        }}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                      onPress={handleVerifyEmailCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitBtnText}>Valider mon nouveau mot de passe ❯</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.backStepBtn}
                      onPress={() => {
                        setEmailStep('request');
                        setErrorMsg(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.backStepBtnText}>❮ Modifier mon identifiant / Renvoyer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* ================= METHODE 2 : CLE DE SECOURS (CODE AMI) ================= */}
            {method === 'rescue' && (
              <View style={styles.stepContainer}>
                <Text style={styles.sectionHelp}>
                  Idéal si vous n’avez pas encore renseigné d’e-mail ou si vous avez perdu son accès. Utilisez votre Code Ami unique à 5 chiffres pour réinitialiser votre accès.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nom d’utilisateur (Pseudo)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Alex"
                    placeholderTextColor={Colors.textMuted}
                    value={rescueUsername}
                    onChangeText={(t) => {
                      setRescueUsername(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Code Ami Athlète (5 chiffres)</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="Ex: 48219"
                    placeholderTextColor={Colors.textMuted}
                    value={rescueFriendCode}
                    onChangeText={(t) => {
                      setRescueFriendCode(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <Text style={styles.helperText}>
                    Le code unique visible dans votre profil ou partagé avec vos amis
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Adresse e-mail</Text>
                    <Text style={styles.optionalBadge}>Sécurisation</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: alex@exemple.com"
                    placeholderTextColor={Colors.textMuted}
                    value={rescueEmail}
                    onChangeText={(t) => {
                      setRescueEmail(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  <Text style={styles.helperText}>
                    Sera enregistrée pour les futures récupérations
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
                    <TouchableOpacity
                      onPress={() => setShowPassword((p) => !p)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.toggleText}>
                        {showPassword ? 'Masquer 🙈' : 'Afficher 👁️'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    value={rescueNewPassword}
                    onChangeText={(t) => {
                      setRescueNewPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                  />
                  <Text style={styles.helperText}>Minimum 4 caractères</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirmer le nouveau mot de passe</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    value={rescueConfirmPassword}
                    onChangeText={(t) => {
                      setRescueConfirmPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleRescueReset}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Réinitialiser mon mot de passe ❯</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = (props) => {
  if (!props.visible) return null;
  return <ForgotPasswordModalContent {...props} />;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#111113',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: '#27272A',
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHelp: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  stepContainer: {
    paddingBottom: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E4E4E7',
    marginBottom: 6,
  },
  toggleText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  codeInput: {
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  optionalBadge: {
    fontSize: 11,
    color: '#38BDF8',
    fontStyle: 'italic',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  backStepBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  backStepBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
    color: '#F87171',
    fontSize: 12,
    lineHeight: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  infoIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    color: '#38BDF8',
    fontSize: 12,
    lineHeight: 16,
  },
});
