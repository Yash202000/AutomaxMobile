import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { KFF_COLORS } from '../kffTheme';

export interface KffProfile {
  id: string;
  name: string;
  isAdmin?: boolean;
}

interface KffProfileCarouselProps {
  profiles: KffProfile[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const CARD_WIDTH = 124;
const CARD_HEIGHT = 168;
const GAP = 12;
const ITEM_WIDTH = CARD_WIDTH + GAP;

// "Select your profile": swipe left/right (or tap a card) to pick who logs in.
// The centred card is the selection and is drawn full size; its neighbours
// shrink as they move away from the centre.
const KffProfileCarousel = ({ profiles, selectedIndex, onSelect }: KffProfileCarouselProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(selectedIndex * ITEM_WIDTH)).current;
  const [width, setWidth] = useState(0);
  const sidePadding = Math.max(0, (width - ITEM_WIDTH) / 2);

  // Re-centre the selection when the list is laid out or reloaded. Read via a
  // ref so swipes/taps (which already scrolled) don't trigger a jump.
  const selectedRef = useRef(selectedIndex);
  useEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    if (width > 0) scrollRef.current?.scrollTo({ x: selectedRef.current * ITEM_WIDTH, animated: false });
  }, [width, profiles.length]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(profiles.length - 1, index));
    if (clamped !== selectedIndex) onSelect(clamped);
  };

  const selectByTap = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * ITEM_WIDTH, animated: true });
    onSelect(index);
  };

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          // Keep the swipe order stable in Arabic (RTL) as well.
          style={styles.ltr}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          contentOffset={{ x: selectedIndex * ITEM_WIDTH, y: 0 }}
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={settle}
        >
          {profiles.map((profile, index) => {
            const inputRange = [(index - 1) * ITEM_WIDTH, index * ITEM_WIDTH, (index + 1) * ITEM_WIDTH];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.82, 1, 0.82],
              extrapolate: 'clamp',
            });
            const selected = index === selectedIndex;
            return (
              <Animated.View key={profile.id} style={[styles.item, { transform: [{ scale }] }]}>
                <Pressable
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => selectByTap(index)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={profile.name}
                >
                  <View style={styles.avatar}>
                    <Ionicons
                      name={profile.isAdmin ? 'shield-checkmark' : 'person'}
                      size={30}
                      color="#B7BCD6"
                    />
                  </View>
                  <Text style={styles.name} numberOfLines={2}>
                    {profile.name}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: CARD_HEIGHT + 8,
    marginHorizontal: -18, // run edge to edge inside the card's padding
    justifyContent: 'center',
  },
  ltr: {
    direction: 'ltr',
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#8FA3F5',
    backgroundColor: '#F6F7FB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 8,
  },
  cardSelected: {
    borderColor: KFF_COLORS.primary,
    borderWidth: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8EAF4',
    borderWidth: 1,
    borderColor: '#DADDEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    color: KFF_COLORS.primary,
    textAlign: 'center',
  },
});

export default KffProfileCarousel;
