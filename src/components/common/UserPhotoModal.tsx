import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Button } from './Button';

export interface UserPhotoModalProps {
  visible: boolean;
  avatarUrl?: string | null;
  userName?: string;
  userSubtitle?: string;
  fallbackEmoji?: string;
  onClose: () => void;
  onEditPress?: () => void;
}

export const UserPhotoModal: React.FC<UserPhotoModalProps> = ({
  visible,
  avatarUrl,
  userName = 'Photo de profil',
  userSubtitle,
  fallbackEmoji = '👤',
  onClose,
  onEditPress,
}) => {
  const [imageLoading, setImageLoading] = useState(Boolean(avatarUrl));
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [prevUrl, setPrevUrl] = useState(avatarUrl);

  // Synchronisation lors du changement d'URL pendant le rendu
  if (prevUrl !== avatarUrl) {
    setPrevUrl(avatarUrl);
    setImageError(false);
    setImageLoading(Boolean(avatarUrl));
    setIsZoomed(false);
    scaleAnim.setValue(1);
  }

  // Support touche Échap sur navigateur Web
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const toggleZoom = () => {
    const nextZoom = !isZoomed;
    setIsZoomed(nextZoom);
    Animated.spring(scaleAnim, {
      toValue: nextZoom ? 1.35 : 1,
      useNativeDriver: Platform.OS !== 'web',
      friction: 6,
    }).start();
  };

  if (!visible) {
    return null;
  }

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Taille dynamique et responsive de la photo
  const cardMaxWidth = Math.min(screenWidth - 32, 420);
  const photoSize = Math.min(cardMaxWidth - 36, screenHeight * 0.46, 340);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer la vue agrandie"
      >
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <View style={[styles.card, { width: cardMaxWidth }]}>
            {/* EN-TÊTE : NOM DE L'UTILISATEUR & BOUTON FERMER */}
            <View style={styles.header}>
              <View style={styles.headerTextCol}>
                <Text style={styles.title} numberOfLines={1}>
                  {userName}
                </Text>
                {Boolean(userSubtitle) && (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {userSubtitle}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Fermer"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* CONTENEUR PHOTO HD */}
            <View style={[styles.photoFrame, { width: photoSize, height: photoSize }]}>
              {avatarUrl && !imageError ? (
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={toggleZoom}
                  style={styles.photoTouchable}
                  accessibilityLabel="Photo en grand, touchez pour zoomer"
                >
                  <Animated.Image
                    source={{ uri: avatarUrl }}
                    style={[
                      styles.photo,
                      {
                        width: photoSize,
                        height: photoSize,
                        transform: [{ scale: scaleAnim }],
                      },
                    ]}
                    resizeMode="cover"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                  />
                  {imageLoading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.fallbackBox}>
                  <Text style={styles.fallbackEmoji}>{fallbackEmoji}</Text>
                  <Text style={styles.fallbackNote}>Aucune photo disponible</Text>
                </View>
              )}
            </View>

            {/* INDICATION DE ZOOM */}
            {avatarUrl && !imageError && (
              <TouchableOpacity
                style={styles.zoomHintBox}
                onPress={toggleZoom}
                activeOpacity={0.75}
              >
                <Text style={styles.zoomHintText}>
                  {isZoomed ? '🔍 Zoom 1.35x actif (touchez pour réduire)' : '🔍 Touchez la photo pour zoomer'}
                </Text>
              </TouchableOpacity>
            )}

            {/* ACTIONS : MODIFIER (SI PROPRIÉTAIRE) / FERMER */}
            <View style={styles.actionsBox}>
              {onEditPress && (
                <Button
                  title="📷 Modifier la photo"
                  variant="primary"
                  size="md"
                  onPress={() => {
                    onClose();
                    onEditPress();
                  }}
                  style={{ width: '100%', marginBottom: 8 }}
                />
              )}
              <Button
                title="Fermer"
                variant={onEditPress ? 'ghost' : 'outline'}
                size="md"
                onPress={onClose}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 99999,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  photoFrame: {
    borderRadius: 20,
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  photoTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    borderRadius: 18,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fallbackEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  fallbackNote: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  zoomHintBox: {
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  zoomHintText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  actionsBox: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
});
