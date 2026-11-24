#!/bin/sh
# Xcode build phase "[Env] Apply app version": copies the app version from the
# project .env into the built Info.plist, the same values app.config.js and
# android/app/build.gradle use:
#   EXPO_PUBLIC_APP_VERSION      -> CFBundleShortVersionString (e.g. 1.0.0)
#   EXPO_PUBLIC_APP_VERSION_CODE -> CFBundleVersion            (e.g. 2)
# Commented-out lines are ignored; the last active line wins. When a key is
# missing, the value from ios/<App>/Info.plist is kept.

ENV_FILE="${PROJECT_DIR}/../.env"
PLIST="${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}"

if [ ! -f "$ENV_FILE" ] || [ ! -f "$PLIST" ]; then
  echo "note: [Env] .env or Info.plist not found, app version left as is"
  exit 0
fi

env_value() {
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 \
    | sed -e 's/^[^=]*=//' -e 's/#.*$//' | tr -d "\"' \t\r"
}

VERSION="$(env_value EXPO_PUBLIC_APP_VERSION)"
BUILD="$(env_value EXPO_PUBLIC_APP_VERSION_CODE)"

if [ -n "$VERSION" ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$PLIST"
fi
if [ -n "$BUILD" ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD" "$PLIST"
fi
echo "note: [Env] app version ${VERSION:-unchanged} (${BUILD:-unchanged})"
