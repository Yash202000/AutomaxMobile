import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { KFF_COLORS } from './kffTheme';

// Full-screen KFF map-line background (assets/images/kff/kff-background.svg).
// Rendered with expo-image, which supports SVG natively — no react-native-svg needed.
const KffBackground = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={[styles.container, style]}>
    <Image
      source={require('@/assets/images/kff/kff-background.svg')}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      pointerEvents="none"
    />
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KFF_COLORS.background,
  },
});

export default KffBackground;
