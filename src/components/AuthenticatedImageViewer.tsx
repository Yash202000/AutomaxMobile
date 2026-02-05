import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Text,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
  token: string;
}

export const AuthenticatedImageViewer: React.FC<AuthenticatedImageViewerProps> = ({
  images,
  imageIndex,
  visible,
  onRequestClose,
  token,
}) => {
  const [currentIndex, setCurrentIndex] = useState(imageIndex);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Update current index when imageIndex prop changes
  React.useEffect(() => {
    setCurrentIndex(imageIndex);
    // Reset scale when image changes
    scale.value = withSpring(1);
    savedScale.value = 1;
  }, [imageIndex]);

  // Create pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      scale.value = withSpring(1);
      savedScale.value = 1;
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      scale.value = withSpring(1);
      savedScale.value = 1;
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
            <TouchableOpacity onPress={onRequestClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Image Container */}
          <View style={styles.imageContainer}>
            <GestureDetector gesture={pinchGesture}>
              <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                <Image
                  source={{
                    uri: currentImage?.uri,
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
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
                  name="chevron-back"
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
                  name="chevron-forward"
                  size={32}
                  color={currentIndex === images.length - 1 ? '#666' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Pinch to zoom hint */}
          <View style={styles.hintContainer}>
            <Ionicons name="expand-outline" size={16} color="#FFFFFF80" />
            <Text style={styles.hintText}>Pinch to zoom</Text>
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
