import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryBtn;
      case 'secondary':
        return styles.secondaryBtn;
      case 'success':
        return styles.successBtn;
      case 'danger':
        return styles.dangerBtn;
      case 'outline':
        return styles.outlineBtn;
      case 'ghost':
        return styles.ghostBtn;
      default:
        return styles.primaryBtn;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return styles.outlineText;
      case 'ghost':
        return styles.ghostText;
      case 'secondary':
        return styles.secondaryText;
      default:
        return styles.defaultText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.smBtn;
      case 'lg':
        return styles.lgBtn;
      default:
        return styles.mdBtn;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.smText;
      case 'lg':
        return styles.lgText;
      default:
        return styles.mdText;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.base,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabledBtn,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.text} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.baseText,
              getTextStyle(),
              getTextSizeStyle(),
              icon ? { marginLeft: 8 } : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  smBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  mdBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  lgBtn: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
  },
  secondaryBtn: {
    backgroundColor: Colors.buttonGray,
  },
  successBtn: {
    backgroundColor: Colors.success,
  },
  dangerBtn: {
    backgroundColor: Colors.danger,
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghostBtn: {
    backgroundColor: 'transparent',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  baseText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  smText: {
    fontSize: 13,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },
  defaultText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: Colors.text,
  },
  outlineText: {
    color: Colors.primary,
  },
  ghostText: {
    color: Colors.textSecondary,
  },
});
