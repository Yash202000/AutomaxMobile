const appName = process.env.APP_NAME || "Automax";

// KFF Dispatcher build has its own launcher icon and splash. Same flag as
// src/utils/kff.ts so one .env switch drives both native assets and JS.
const isKff = process.env.EXPO_PUBLIC_KFF_DISPATHER === "true";

const appIcon = isKff
  ? "./assets/images/kff/kff-app-icon.png"
  : "./assets/images/start-logo.png";
// Android adaptive icons crop the foreground to a circle/squircle, so KFF uses
// a transparent variant with the logo kept inside the safe zone.
const adaptiveIconForeground = isKff
  ? "./assets/images/kff/kff-adaptive-icon.png"
  : appIcon;

// Native splash: Android 12+ only supports a centred icon on a solid colour, so
// the KFF native splash is the Automax wordmark on the background's mid blue.
// The full network-background design is drawn in JS (src/components/kff/KffSplash).
const splashConfig = isKff
  ? {
      image: "./assets/images/kff/kff-splash-logo.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#2235B6",
      dark: { backgroundColor: "#2235B6" },
    }
  : {
      image: "./assets/images/start-logo.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: { backgroundColor: "#000000" },
    };

// Maps: with a key every map screen uses native Google Maps; without one the
// app keeps its OpenStreetMap (Leaflet) maps and no Google SDK key is injected.
// The key is baked into the native projects at prebuild time (Info.plist /
// AppDelegate on iOS, AndroidManifest on Android), so changing it needs a new
// build — it is also exposed to JS as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    name: appName,
    slug: "AutomaxMobile",
    version: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
    orientation: "portrait",
    icon: appIcon,
    scheme: "automaxmobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || "com.automax.mobile",
      buildNumber: process.env.EXPO_PUBLIC_APP_VERSION_CODE,
      googleServicesFile: "./GoogleService-Info.plist",
      ...(googleMapsApiKey && { config: { googleMapsApiKey } }),
      infoPlist: {
        // Required for Linking.canOpenURL('comgooglemaps://...') to detect
        // whether the Google Maps app is installed (iOS 9+ query whitelist).
        LSApplicationQueriesSchemes: ["comgooglemaps"],
      },
    },
    android: {
      package: process.env.ANDROID_PACKAGE || "com.automax.mobile",
      versionCode: parseInt(
        process.env.EXPO_PUBLIC_APP_VERSION_CODE || "1",
        10,
      ),
      supportsRTL: true,
      adaptiveIcon: {
        foregroundImage: adaptiveIconForeground,
        backgroundColor: process.env.APP_ICON_BG_COLOR || "#ffffff",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      googleServicesFile: "./google-services.json",
      ...(googleMapsApiKey && { config: { googleMaps: { apiKey: googleMapsApiKey } } }),
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
      ],
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "./plugins/withAndroidGoogleServices",
      "@react-native-firebase/app",
      "expo-router",
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to use your location.",
          locationAlwaysPermission:
            "Allow $(PRODUCT_NAME) to use your location.",
          locationWhenInUsePermission:
            "Allow $(PRODUCT_NAME) to use your location.",
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
      ["expo-splash-screen", splashConfig],
      "@react-native-community/datetimepicker",
      // The expo-dev-client network inspector on iOS bypasses certificate
      // pinning in development builds; release builds are unaffected.
      ["expo-build-properties", { ios: { networkInspector: false } }],
      [
        "expo-media-library",
        {
          photosPermission:
            "Allow $(PRODUCT_NAME) to save downloaded images to your Photos.",
          savePhotosPermission:
            "Allow $(PRODUCT_NAME) to save downloaded images to your Photos.",
          isAccessMediaLocationEnabled: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
