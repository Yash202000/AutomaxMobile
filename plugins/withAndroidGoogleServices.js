/**
 * withAndroidGoogleServices.js — Expo Config Plugin
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `expo prebuild --clean` regenerates the entire android/ directory from scratch,
 * wiping any manual edits to build.gradle files. This plugin runs automatically
 * during prebuild and re-applies the required Firebase / Notifee changes so they
 * are never lost.
 *
 * WHAT IT MODIFIES
 * ----------------
 * 1. android/build.gradle  (project-level)
 *    - Adds `classpath('com.google.gms:google-services:4.4.4')` inside
 *      buildscript > dependencies, before the AGP classpath line.
 *    - Adds the Notifee local maven repository inside allprojects > repositories:
 *        maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }
 *
 * 2. android/app/build.gradle  (app-level)
 *    - Applies the Google Services plugin at the top of the file (alongside the
 *      other `apply plugin` declarations):
 *        apply plugin: 'com.google.gms.google-services'
 *    - Adds the Firebase BOM inside dependencies, right after react-android:
 *        implementation platform('com.google.firebase:firebase-bom:34.10.0')
 *
 * 3. android/app/google-services.json  (copied from project root)
 *    - google-services.json is required by Firebase and Notifee for the native
 *      module to initialize at runtime. Without it the app crashes with
 *      "notifee native module not found".
 *    - Place your google-services.json at the PROJECT ROOT (next to app.config.js).
 *      This plugin copies it to android/app/ on every prebuild so it is never lost.
 *    - To update: replace the file at the project root and re-run prebuild.
 *
 * HOW TO CHANGE THINGS
 * --------------------
 * - Bump google-services classpath version → change the string in `classpathEntry`
 * - Bump Firebase BOM version             → change the string in `firebaseBom`
 * - Add another maven repo                → follow the same pattern as notifeeRepo
 *   inside withProjectGradle using contents.replace() with an idempotent includes() guard
 * - Add another app-level dependency      → follow the same pattern as firebaseBom
 *   inside withAppGradle
 * - Update google-services.json          → replace file at project root, re-run prebuild
 *
 * All replacements are idempotent: they check via includes() before inserting,
 * so running prebuild multiple times will never duplicate any line.
 *
 * REGISTERED IN
 * -------------
 * app.config.js → expo.plugins → './plugins/withAndroidGoogleServices'
 */

const { withProjectBuildGradle, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withProjectGradle = (config) => {
  return withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 1. Add google-services classpath after the AGP classpath line
    const classpathEntry = "classpath('com.google.gms:google-services:4.4.4')";
    if (!contents.includes(classpathEntry)) {
      contents = contents.replace(
        /classpath\(['"]com\.android\.tools\.build:gradle['"]/,
        `${classpathEntry}\n    classpath('com.android.tools.build:gradle'`
      );
    }

    // 2. Add Notifee local maven repo in allprojects > repositories
    if (!contents.includes('@notifee/react-native/android/libs')) {
      contents = contents.replace(
        /(allprojects\s*\{\s*repositories\s*\{)/,
        `$1\n    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

const withAppGradle = (config) => {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 1. Add google-services plugin at the top with other apply plugin lines
    const applyLine = "apply plugin: 'com.google.gms.google-services'";
    if (!contents.includes(applyLine)) {
      contents = contents.replace(
        'apply plugin: "com.facebook.react"',
        `apply plugin: "com.facebook.react"\n${applyLine}`
      );
    }

    // 2. Add Firebase BOM after the react-android implementation line
    const firebaseBom = "    implementation platform('com.google.firebase:firebase-bom:34.10.0')";
    if (!contents.includes('firebase-bom')) {
      contents = contents.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")\n${firebaseBom}`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

/**
 * Copies google-services.json from the project root into android/app/
 * so it survives every `expo prebuild --clean`.
 * Source: <projectRoot>/google-services.json
 * Dest:   <projectRoot>/android/app/google-services.json
 */
const withGoogleServicesJson = (config) => {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const src = path.join(projectRoot, 'google-services.json');
      const dest = path.join(projectRoot, 'android', 'app', 'google-services.json');

      if (!fs.existsSync(src)) {
        throw new Error(
          '[withAndroidGoogleServices] google-services.json not found at project root.\n' +
          'Download it from Firebase Console → Project Settings → Your Android app\n' +
          `and place it at: ${src}`
        );
      }

      fs.copyFileSync(src, dest);
      return mod;
    },
  ]);
};

module.exports = (config) => {
  config = withProjectGradle(config);
  config = withAppGradle(config);
  config = withGoogleServicesJson(config);
  return config;
};
