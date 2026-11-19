import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

import { KFF_AUTH_BLUE } from './kffAuthTheme';
import { KFF_COLORS } from '../kffTheme';

interface KffAuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Fully rounded ends (create-passcode screen) vs. soft corners (login). */
  pill?: boolean;
  style?: ViewStyle;
}

const KffAuthButton = ({ title, onPress, loading, disabled, pill, style }: KffAuthButtonProps) => (
  <TouchableOpacity
    style={[styles.button, pill && styles.pill, (disabled || loading) && styles.disabled, style]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
    accessibilityRole="button"
  >
    {loading ? (
      <ActivityIndicator color={KFF_COLORS.white} />
    ) : (
      <Text style={styles.text}>{title}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: KFF_AUTH_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: KFF_AUTH_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  pill: {
    borderRadius: 30,
  },
  disabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: KFF_COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

export default KffAuthButton;
