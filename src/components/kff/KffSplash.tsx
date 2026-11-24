import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';

// Logo aspect ratio of assets/images/kff/kff-splash-logo.png (245 x 58).
const LOGO_ASPECT = 245 / 58;

// KFF launch screen shown after the native splash while the session restores:
// network background stretched edge to edge with the Automax wordmark at the
// vertical centre, matching the KFF splash design.
const KffSplash = () => {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(width * 0.52, 420);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('@/assets/images/kff/kff-splash-background.jpg')}
        style={styles.background}
        resizeMode="stretch"
      >
        <Image
          source={require('@/assets/images/kff/kff-splash-logo.png')}
          style={[styles.logo, { width: logoWidth, height: logoWidth / LOGO_ASPECT, marginLeft: width * 0.12 }]}
          resizeMode="contain"
        />
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    backgroundColor: '#2235B6',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'flex-start',
  },
});

export default KffSplash;
