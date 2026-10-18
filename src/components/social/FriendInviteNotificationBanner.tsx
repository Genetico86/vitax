import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { FriendRequest } from '../../types/social';
import {
  getPendingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from '../../services/multiplayerService';
import { getSupabaseClient, isSupabaseConfigured } from '../../services/supabaseClient';
import { showAlert } from '../../utils/alert';

interface Props {
  onFriendAccepted?: () => void;
}

export function FriendInviteNotificationBanner({ onFriendAccepted }: Props) {
  const insets = useSafeAreaInsets();
  const [currentRequest, setCurrentRequest] = useState<FriendRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(-150));
  const isVisibleRef = useRef(false);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      isVisibleRef.current = false;
      setCurrentRequest(null);
    });
  }, [slideAnim]);

  const checkPendingRequests = useCallback(async () => {
    try {
      const pending = await getPendingFriendRequests();
      // Filtrer les requêtes déjà rejetées ou ignorées pendant cette session
      const available = pending.filter((r) => !dismissedIdsRef.current.has(r.id));

      if (available.length > 0) {
        const top = available[0];
        if (!currentRequest || currentRequest.id !== top.id) {
          setCurrentRequest(top);
          if (!isVisibleRef.current) {
            isVisibleRef.current = true;
            // Vibreur d'alerte pour notifier l'athlète
            try {
              if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {}

            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: Platform.OS !== 'web',
              tension: 80,
              friction: 9,
            }).start();
          }
        }
      } else {
        if (isVisibleRef.current) {
          hideBanner();
        }
      }
    } catch (err) {
      console.warn('Erreur vérification demandes d’amis:', err);
    }
  }, [currentRequest, hideBanner, slideAnim]);

  useEffect(() => {
    // Vérification initiale
    void checkPendingRequests();

    // Abonnement Supabase Realtime sur friend_requests pour éviter le polling intensif toutes les 10s
    let realtimeChannel: any = null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          realtimeChannel = supabase
            .channel('vitax-friend-invites-live')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'friend_requests' },
              () => {
                void checkPendingRequests();
              }
            )
            .subscribe();
        } catch {}
      }
    }

    // Filet de sécurité espacé (60s) en cas de coupure WebSocket
    const timer = setInterval(() => {
      void checkPendingRequests();
    }, 60000);

    return () => {
      clearInterval(timer);
      if (realtimeChannel && isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          void supabase.removeChannel(realtimeChannel);
        }
      }
    };
  }, [checkPendingRequests]);

  const handleAccept = async () => {
    if (!currentRequest || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await acceptFriendRequest(currentRequest.id);
      if (res.success && res.friend) {
        if (Platform.OS !== 'web') {
          try {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
        }
        hideBanner();
        showAlert(
          'Ami ajouté ! 🎉',
          `Vous êtes désormais ami avec ${res.friend.username} (${res.friend.friendCode}). Vos classements et défis sont désormais partagés !`
        );
        onFriendAccepted?.();
      } else {
        showAlert('Info', res.error || 'Impossible d’accepter la demande.');
        hideBanner();
      }
    } catch (err: any) {
      showAlert('Erreur', err?.message || 'Erreur lors de l’acceptation.');
      hideBanner();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentRequest || isProcessing) return;
    setIsProcessing(true);
    try {
      dismissedIdsRef.current.add(currentRequest.id);
      await declineFriendRequest(currentRequest.id);
      hideBanner();
    } catch {
      hideBanner();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    if (currentRequest) {
      dismissedIdsRef.current.add(currentRequest.id);
    }
    hideBanner();
  };

  if (!currentRequest) return null;

  const topOffset = Math.max(insets.top, 12);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.card}>
        {/* En-tête Notification */}
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={styles.pulsingDot} />
            <Text style={styles.badgeText}>DEMANDE D’AMI REÇUE 👥</Text>
          </View>
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Info de l'expéditeur */}
        <View style={styles.bodyRow}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 28 }}>{currentRequest.senderAvatarEmoji || '⚡'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.senderName} numberOfLines={1}>
              {currentRequest.senderName}
            </Text>
            <Text style={styles.senderSub}>
              Code: <Text style={styles.codeHighlight}>{currentRequest.senderCode}</Text> •{' '}
              {currentRequest.senderTrainerTitle || 'Athlète Vitax'}
            </Text>
            <Text style={styles.invitePrompt}>
              Souhaite vous ajouter à son cercle d’entraînement !
            </Text>
          </View>
        </View>

        {/* Boutons d'Action Rapide */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={handleDecline}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Text style={styles.declineBtnText}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={handleAccept}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptBtnText}>
              {isProcessing ? 'Connexion...' : 'Accepter l’ami ✅'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  senderSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  codeHighlight: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  invitePrompt: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  declineBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
