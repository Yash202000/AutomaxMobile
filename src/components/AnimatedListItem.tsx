import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
}

const STAGGER_STEP_MS = 40;
const MAX_DELAY_MS = 300;

/** Minimal fade + slide-up entrance for list cards, staggered by index. */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index = 0,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 250,
      delay: Math.min(index * STAGGER_STEP_MS, MAX_DELAY_MS),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};
