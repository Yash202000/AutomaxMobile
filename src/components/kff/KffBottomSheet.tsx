import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { KFF_COLORS, KFF_SHADOWS } from './kffTheme';

interface KffBottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const FLING_VELOCITY = 600;
const ANIMATION = { duration: 220 };

/**
 * Bottom sheet that opens at half the screen. Dragging the header up expands
 * it to full screen; dragging down shrinks it back to half, then closes it.
 * The body scrolls on its own (`children` should be a ScrollView/FlatList).
 */
const KffBottomSheet = ({ visible, title, onClose, children }: KffBottomSheetProps) => {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const halfHeight = windowHeight * 0.5;
  const fullHeight = windowHeight - insets.top - 8;

  const sheetHeight = useSharedValue(halfHeight);
  const dragStart = useSharedValue(halfHeight);

  useEffect(() => {
    if (visible) sheetHeight.value = halfHeight;
  }, [visible, halfHeight, sheetHeight]);

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = sheetHeight.value;
    })
    .onUpdate((e) => {
      sheetHeight.value = Math.min(fullHeight, Math.max(0, dragStart.value - e.translationY));
    })
    .onEnd((e) => {
      const height = sheetHeight.value;
      const flingUp = e.velocityY < -FLING_VELOCITY;
      const flingDown = e.velocityY > FLING_VELOCITY;
      if (flingUp || (!flingDown && height > (halfHeight + fullHeight) / 2)) {
        sheetHeight.value = withTiming(fullHeight, ANIMATION);
      } else if ((flingDown && dragStart.value <= halfHeight + 1) || height < halfHeight * 0.6) {
        sheetHeight.value = withTiming(0, ANIMATION, (finished) => {
          if (finished) scheduleOnRN(onClose);
        });
      } else {
        sheetHeight.value = withTiming(halfHeight, ANIMATION);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ height: sheetHeight.value }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom }]}>
          <GestureDetector gesture={pan}>
            <View style={styles.header}>
              <View style={styles.handle} />
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel={t('common.close')}>
                  <Ionicons name="close" size={22} color={KFF_COLORS.navy} />
                </TouchableOpacity>
              </View>
            </View>
          </GestureDetector>
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  sheet: {
    backgroundColor: KFF_COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: KFF_COLORS.divider,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: KFF_COLORS.navy,
    textAlign: 'left',
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: KFF_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...KFF_SHADOWS.card,
  },
  body: {
    flex: 1,
  },
});

export default KffBottomSheet;
