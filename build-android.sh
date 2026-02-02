#!/bin/bash

# Android Build Script for AutomaxMobile
# This script automates the local Android build process

set -e  # Exit on error

echo "========================================="
echo "   AutomaxMobile - Android Builder"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Java is installed
echo -e "${BLUE}Checking Java installation...${NC}"
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java not found! Please install JDK 17${NC}"
    echo "   Run: sudo apt install openjdk-17-jdk"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
echo -e "${GREEN}✓ Java version: $JAVA_VERSION${NC}"

# Check if Android SDK is installed
echo -e "${BLUE}Checking Android SDK...${NC}"
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${RED}❌ ANDROID_HOME not set!${NC}"
    echo "   Please set ANDROID_HOME environment variable"
    echo "   Example: export ANDROID_HOME=\$HOME/Android/Sdk"
    exit 1
fi

if [ ! -d "$ANDROID_HOME" ]; then
    echo -e "${RED}❌ Android SDK not found at: $ANDROID_HOME${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Android SDK found at: $ANDROID_HOME${NC}"

# Check if adb is available
echo -e "${BLUE}Checking ADB...${NC}"
if ! command -v adb &> /dev/null; then
    echo -e "${YELLOW}⚠ ADB not found in PATH${NC}"
else
    echo -e "${GREEN}✓ ADB available${NC}"
fi

echo ""
echo "========================================="
echo "   Build Options"
echo "========================================="
echo "1. Debug APK (Fast, for testing)"
echo "2. Release APK (Optimized, for distribution)"
echo "3. Clean build (Remove previous builds)"
echo "4. Install APK on connected device"
echo "5. Exit"
echo ""
read -p "Select option (1-5): " option

case $option in
    1)
        echo ""
        echo -e "${BLUE}Building Debug APK...${NC}"

        # Check if android folder exists
        if [ ! -d "android" ]; then
            echo -e "${YELLOW}Android folder not found. Running prebuild...${NC}"
            npx expo prebuild --platform android
        fi

        cd android
        ./gradlew assembleDebug

        echo ""
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}✓ Debug APK built successfully!${NC}"
        echo -e "${GREEN}=========================================${NC}"
        echo ""
        echo -e "Location: ${YELLOW}android/app/build/outputs/apk/debug/app-debug.apk${NC}"
        echo ""
        read -p "Install on connected device? (y/n): " install
        if [ "$install" = "y" ]; then
            if command -v adb &> /dev/null; then
                echo -e "${BLUE}Installing APK...${NC}"
                adb install -r app/build/outputs/apk/debug/app-debug.apk
                echo -e "${GREEN}✓ APK installed!${NC}"
            else
                echo -e "${RED}❌ ADB not available${NC}"
            fi
        fi
        ;;

    2)
        echo ""
        echo -e "${BLUE}Building Release APK...${NC}"

        # Check if android folder exists
        if [ ! -d "android" ]; then
            echo -e "${YELLOW}Android folder not found. Running prebuild...${NC}"
            npx expo prebuild --platform android
        fi

        # Check if keystore exists
        if [ ! -f "android/app/automax-release-key.keystore" ]; then
            echo -e "${YELLOW}⚠ Keystore not found!${NC}"
            echo "Please generate a keystore first:"
            echo ""
            echo "keytool -genkeypair -v -storetype PKCS12 \\"
            echo "  -keystore automax-release-key.keystore \\"
            echo "  -alias automax-key-alias \\"
            echo "  -keyalg RSA -keysize 2048 -validity 10000"
            echo ""
            echo "Then copy it to: android/app/"
            exit 1
        fi

        cd android
        ./gradlew assembleRelease

        echo ""
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}✓ Release APK built successfully!${NC}"
        echo -e "${GREEN}=========================================${NC}"
        echo ""
        echo -e "Location: ${YELLOW}android/app/build/outputs/apk/release/app-release.apk${NC}"
        echo ""
        ;;

    3)
        echo ""
        echo -e "${BLUE}Cleaning build...${NC}"

        if [ -d "android" ]; then
            cd android
            ./gradlew clean
            echo -e "${GREEN}✓ Build cleaned!${NC}"
        else
            echo -e "${YELLOW}No android folder to clean${NC}"
        fi

        echo -e "${BLUE}Cleaning node modules cache...${NC}"
        rm -rf node_modules/.cache

        echo -e "${GREEN}✓ Clean complete!${NC}"
        echo ""
        echo "You can now run this script again to build."
        ;;

    4)
        echo ""
        echo -e "${BLUE}Checking for APK files...${NC}"

        DEBUG_APK="android/app/build/outputs/apk/debug/app-debug.apk"
        RELEASE_APK="android/app/build/outputs/apk/release/app-release.apk"

        if [ -f "$DEBUG_APK" ]; then
            echo "Found: Debug APK"
            echo -e "${BLUE}Installing Debug APK...${NC}"
            adb install -r "$DEBUG_APK"
            echo -e "${GREEN}✓ Debug APK installed!${NC}"
        elif [ -f "$RELEASE_APK" ]; then
            echo "Found: Release APK"
            echo -e "${BLUE}Installing Release APK...${NC}"
            adb install -r "$RELEASE_APK"
            echo -e "${GREEN}✓ Release APK installed!${NC}"
        else
            echo -e "${RED}❌ No APK found! Please build first.${NC}"
        fi
        ;;

    5)
        echo "Exiting..."
        exit 0
        ;;

    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done! 🎉${NC}"
