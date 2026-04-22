const appName = process.env.APP_NAME || 'Automax';
const appIcon = './assets/images/start-logo.png';

module.exports = {
  expo: {
    name: appName,
    slug: 'AutomaxMobile',
    version: process.env.APP_VERSION || '1.0.0',
    orientation: 'portrait',
    icon: appIcon,
    scheme: 'automaxmobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.automax.vdcop',
    },
    android: {
      package: process.env.ANDROID_PACKAGE || 'com.automax.vdcop',
      versionCode: parseInt(process.env.APP_VERSION_CODE || '1', 10),
      supportsRTL: true,
      adaptiveIcon: {
        foregroundImage: appIcon,
        backgroundColor: process.env.APP_ICON_BG_COLOR || '#ffffff',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'RECORD_AUDIO',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      './plugins/withAndroidGoogleServices',
      'expo-router',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location.',
          locationAlwaysPermission: 'Allow $(PRODUCT_NAME) to use your location.',
          locationWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location.',
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/start-logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
