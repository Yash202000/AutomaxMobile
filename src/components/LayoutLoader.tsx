import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";

interface LayoutLoaderProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  scrollable?: boolean;
}

/**
 * Screen-level skeleton loader shell. Compose it with `Skeleton` pieces
 * shaped like the screen's real layout, instead of a centered spinner.
 */
export const LayoutLoader: React.FC<LayoutLoaderProps> = ({
  children,
  style,
  contentStyle,
  scrollable = false,
}) => {
  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.content, contentStyle, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
