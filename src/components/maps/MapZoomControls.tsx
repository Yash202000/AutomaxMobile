import { Ionicons } from "@expo/vector-icons";
import React, { RefObject } from "react";
import { Platform, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import MapView from "react-native-maps";

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

/**
 * +/- buttons over a native Google map (Google's iOS SDK has none, and the
 * Android ones are disabled so both platforms look the same).
 */
export function MapZoomControls({
  mapRef,
  style,
}: {
  mapRef: RefObject<MapView | null>;
  style?: ViewStyle;
}) {
  const zoomBy = async (delta: number) => {
    const camera = await mapRef.current?.getCamera();
    if (!camera || camera.zoom == null) return;
    const zoom = Math.min(Math.max(camera.zoom + delta, MIN_ZOOM), MAX_ZOOM);
    mapRef.current?.animateCamera({ zoom }, { duration: 200 });
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.button} onPress={() => zoomBy(1)} accessibilityLabel="Zoom in">
        <Ionicons name="add" size={22} color="#1A1A2E" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.lastButton]} onPress={() => zoomBy(-1)} accessibilityLabel="Zoom out">
        <Ionicons name="remove" size={22} color="#1A1A2E" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  button: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  lastButton: { borderBottomWidth: 0 },
});
