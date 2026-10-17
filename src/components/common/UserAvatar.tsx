import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface UserAvatarProps {
  avatarUrl?: string | null;
  fallbackEmoji?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showEditBadge?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  fallbackEmoji = '👤',
  size = 44,
  style,
  showEditBadge = false,
  onPress,
  accessibilityLabel = 'Photo de profil',
}) => {
  const [imageError, setImageError] = useState(false);
  const [prevAvatarUrl, setPrevAvatarUrl] = useState(avatarUrl);

  if (prevAvatarUrl !== avatarUrl) {
    setPrevAvatarUrl(avatarUrl);
    setImageError(false);
  }

  const borderRadius = size / 2;
  const badgeSize = Math.max(18, Math.round(size * 0.36));

  const content = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
    >
      {avatarUrl && !imageError ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Text style={[styles.emoji, { fontSize: Math.round(size * 0.52) }]}>
          {fallbackEmoji}
        </Text>
      )}

      {showEditBadge && (
        <View
          style={[
            styles.editBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        >
          <Text style={{ fontSize: Math.max(10, Math.round(badgeSize * 0.58)) }}>📷</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'visible',
    position: 'relative',
  },
  image: {
    backgroundColor: '#0F172A',
  },
  emoji: {
    textAlign: 'center',
  },
  editBadge: {
    position: 'absolute',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
