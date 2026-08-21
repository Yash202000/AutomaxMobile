import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageItem {
  id: string;
  uri: string;
  file_name: string;
}

interface AuthenticatedImageViewerProps {
  images: ImageItem[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  token?: string;
}

export const AuthenticatedImageViewer: React.FC<AuthenticatedImageViewerProps> = ({
  images,
  imageIndex,
  visible,
  onRequestClose,
  token,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(imageIndex);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotation = useSharedValue(0);

  const resetTransform = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    rotation.value = withSpring(0);
  };

  // Update current index when imageIndex prop changes
  React.useEffect(() => {
    setCurrentIndex(imageIndex);
    // Reset zoom/pan/rotation when image changes
    resetTransform();
  }, [imageIndex]);

  const handleRotate = () => {
    rotation.value = withSpring(rotation.value + 90);
  };

  // Pinch to zoom, clamped to [MIN_SCALE, MAX_SCALE]
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE);
        savedScale.value = MAX_SCALE;
      } else {
        savedScale.value = scale.value;
      }
    });

  // Drag to pan around once zoomed in — a no-op at the default zoom level so
  // it never fights with swiping between images.
  const panGesture = Gesture.Pan().onUpdate((event) => {
    if (scale.value <= 1) return;
    translateX.value = savedTranslateX.value + event.translationX;
    translateY.value = savedTranslateY.value + event.translationY;
  }).onEnd(() => {
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  });

  // Double tap toggles between default zoom and a fixed zoomed-in level.
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    doubleTapGesture,
    pinchGesture,
    panGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetTransform();
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetTransform();
    }
  };

  if (!visible || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.backdrop}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>
                {currentIndex + 1} / {images.length}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {currentImage?.file_name}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleRotate} style={styles.headerActionButton}>
                <Ionicons name="reload-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={resetTransform} style={styles.headerActionButton}>
                <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onRequestClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Container */}
          <View style={styles.imageContainer}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                <Image
                  source={{
                    uri: currentImage?.uri,
                    ...(token
                      ? {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        }
                      : {}),
                  }}
                  style={styles.image}
                  contentFit="contain"
                  transition={200}
                />
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Navigation Controls */}
          {images.length > 1 && (
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={handlePrevious}
                disabled={currentIndex === 0}
                style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              >
                <Ionicons
                  name={t('common.icons.chevronBack') as any}
                  size={32}
                  color={currentIndex === 0 ? '#666' : '#FFFFFF'}
                />
              </TouchableOpacity>

              <View style={styles.dotsContainer}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleNext}
                disabled={currentIndex === images.length - 1}
                style={[
                  styles.navButton,
                  currentIndex === images.length - 1 && styles.navButtonDisabled,
                ]}
              >
                <Ionicons
                  name={t('common.icons.chevronForward') as any}
                  size={32}
                  color={currentIndex === images.length - 1 ? '#666' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Pinch to zoom / rotate hint */}
          <View style={styles.hintContainer}>
            <Ionicons name="expand-outline" size={16} color="#FFFFFF80" />
            <Text style={styles.hintText}>
              {t('common.pinchToZoomAndRotate', 'Pinch or double-tap to zoom · rotate to turn')}
            </Text>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#FFFFFF80',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  navButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF40',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    color: '#FFFFFF80',
    fontSize: 12,
  },
});
