import React, { forwardRef, useEffect, useRef } from "react";
import MapView, { MapViewProps, PROVIDER_GOOGLE } from "react-native-maps";
import { reportGoogleFailure } from "@/src/utils/mapProvider";

// How long Google gets to finish rendering its first frame before we give up
// and fall back to OSM. A rejected key (wrong bundle/package restriction,
// disabled API, billing off) leaves the native map blank with no callback.
const LOAD_TIMEOUT_MS = 20000;

/** MapView pinned to the Google provider, with a load watchdog. */
export const NativeGoogleMap = forwardRef<MapView, MapViewProps>(
  function NativeGoogleMap({ onMapLoaded, ...props }, ref) {
    const loaded = useRef(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        if (!loaded.current) {
          reportGoogleFailure("Google Maps did not finish loading — check the API key and its app restrictions");
        }
      }, LOAD_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }, []);

    return (
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        {...props}
        onMapLoaded={(event) => {
          loaded.current = true;
          onMapLoaded?.(event);
        }}
      />
    );
  },
);
