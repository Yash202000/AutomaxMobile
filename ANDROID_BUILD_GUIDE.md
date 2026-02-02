# Android Build Guide - Local Build Steps

Complete guide to building your Android APK locally on your machine.

---

## 📋 Prerequisites

### 1. Install Java Development Kit (JDK)

**Required Version**: JDK 17 (OpenJDK recommended)

#### **For Ubuntu/Linux:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk
java -version  # Should show version 17.x.x
```

#### **For macOS:**
```bash
# Using Homebrew
brew install openjdk@17

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

java -version  # Should show version 17.x.x
```

#### **For Windows:**
1. Download JDK 17 from [Adoptium](https://adoptium.net/temurin/releases/)
2. Install and add to PATH
3. Verify: `java -version`

---

### 2. Install Android Studio

Download and install from: https://developer.android.com/studio

#### **After Installation:**

1. **Open Android Studio**
2. **Configure SDK**:
   - Go to: `Settings` > `Appearance & Behavior` > `System Settings` > `Android SDK`
   - **SDK Platforms** tab: Install `Android 14.0 (API 34)` and `Android 13.0 (API 33)`
   - **SDK Tools** tab: Install:
     - Android SDK Build-Tools (version 34.0.0)
     - Android SDK Command-line Tools
     - Android Emulator
     - Android SDK Platform-Tools
     - Android SDK Tools

3. **Set Environment Variables**:

#### **For Linux/macOS** (add to `~/.bashrc` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Then run:
```bash
source ~/.bashrc  # or ~/.zshrc
```

#### **For Windows** (System Environment Variables):
```
ANDROID_HOME = C:\Users\YourUsername\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\platform-tools
PATH += %ANDROID_HOME%\tools
PATH += %ANDROID_HOME%\tools\bin
```

**Verify Installation:**
```bash
adb --version
```

---

### 3. Install EAS CLI

```bash
npm install -g eas-cli
```

**Login to Expo:**
```bash
eas login
```

---

## 🚀 Method 1: Local Build (Recommended for Development)

This builds the APK on your local machine.

### Step 1: Navigate to Project Directory

```bash
cd /home/developer/workstation/Automax/AutomaxMobile
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Prebuild Android Project

This generates the native Android project:

```bash
npx expo prebuild --platform android
```

This creates an `android/` folder with the native Android project.

### Step 4: Build APK Locally

#### **Option A: Debug APK (Faster, for testing)**

```bash
cd android
./gradlew assembleDebug
```

**Output Location:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

#### **Option B: Release APK (Optimized, for distribution)**

First, generate a keystore for signing:

```bash
# Generate keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore automax-release-key.keystore \
  -alias automax-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Enter:**
- Password: `yourSecurePassword123`
- Your name: `Your Company Name`
- Organizational unit: `Mobile Development`
- Organization: `Automax`
- City, State, Country code

**Create `android/gradle.properties`** (if not exists):
```bash
cd android
nano gradle.properties
```

**Add these lines:**
```properties
MYAPP_RELEASE_STORE_FILE=automax-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=automax-key-alias
MYAPP_RELEASE_STORE_PASSWORD=yourSecurePassword123
MYAPP_RELEASE_KEY_PASSWORD=yourSecurePassword123
```

**Copy keystore to android/app:**
```bash
cp automax-release-key.keystore android/app/
```

**Update `android/app/build.gradle`:**

Find the `android {}` block and add:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Build Release APK:**
```bash
cd android
./gradlew assembleRelease
```

**Output Location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 5: Install APK on Device

#### **Via USB:**
1. Enable USB Debugging on your Android device
2. Connect device via USB
3. Install:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### **Via File Transfer:**
1. Copy APK to your device
2. Open Files app on device
3. Tap APK file
4. Allow "Install from Unknown Sources"
5. Tap "Install"

---

## ☁️ Method 2: EAS Build (Cloud Build)

This builds on Expo's servers (requires internet, free tier available).

### Step 1: Configure EAS

```bash
cd /home/developer/workstation/Automax/AutomaxMobile
eas build:configure
```

### Step 2: Build APK

#### **For Development:**
```bash
eas build --platform android --profile development --local
```

#### **For Preview/Testing:**
```bash
eas build --platform android --profile preview
```

#### **For Production:**
```bash
eas build --platform android --profile production
```

**Add `--local` flag to build locally instead of in the cloud:**
```bash
eas build --platform android --profile preview --local
```

### Step 3: Download and Install

After build completes:
1. EAS will provide a download link
2. Download APK
3. Install on device

---

## 🎯 Quick Commands Cheat Sheet

### **First Time Setup:**
```bash
cd /home/developer/workstation/Automax/AutomaxMobile
npm install
npx expo prebuild --platform android
```

### **Build Debug APK (Fast):**
```bash
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

### **Build Release APK (Production):**
```bash
cd android
./gradlew assembleRelease
# APK at: app/build/outputs/apk/release/app-release.apk
```

### **Clean Build (if issues):**
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### **Check Connected Devices:**
```bash
adb devices
```

### **Uninstall App:**
```bash
adb uninstall com.automax.mobile
```

---

## 🐛 Troubleshooting

### **Problem: "ANDROID_HOME not set"**
**Solution:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### **Problem: "SDK location not found"**
**Solution:** Create `android/local.properties`:
```properties
sdk.dir=/home/yourusername/Android/Sdk
```

### **Problem: "Execution failed for task ':app:validateSigningRelease'"**
**Solution:** Check that:
- Keystore file exists in `android/app/`
- `gradle.properties` has correct values
- Passwords match

### **Problem: "Could not determine java version"**
**Solution:**
```bash
java -version  # Should be 17.x.x
# If wrong version, install JDK 17 and set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

### **Problem: "Gradle build failed"**
**Solution:**
```bash
cd android
./gradlew clean
rm -rf ~/.gradle/caches/
./gradlew assembleDebug --stacktrace
```

### **Problem: "Metro bundler error"**
**Solution:**
```bash
# Clear Metro cache
npx expo start -c
# Or manually
rm -rf node_modules/.cache
npm start -- --reset-cache
```

### **Problem: APK installs but crashes immediately**
**Solution:**
1. Check logs:
```bash
adb logcat | grep "AndroidRuntime"
```
2. Rebuild with:
```bash
npx expo prebuild --clean
cd android
./gradlew clean assembleDebug
```

---

## 📱 Testing on Device

### **View Logs:**
```bash
adb logcat | grep "AutomaxMobile"
```

### **Clear App Data:**
```bash
adb shell pm clear com.automax.mobile
```

### **Take Screenshot:**
```bash
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

---

## 📦 Build Outputs

### **Debug APK:**
- **Location:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Size:** ~50-80 MB (unoptimized)
- **Use:** Development and testing
- **Requires:** No signing

### **Release APK:**
- **Location:** `android/app/build/outputs/apk/release/app-release.apk`
- **Size:** ~20-40 MB (optimized)
- **Use:** Production/distribution
- **Requires:** Keystore signing

### **AAB (Android App Bundle):**
```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```
**Use:** Google Play Store upload (recommended)

---

## 🔐 Important Notes

### **Security:**
- ⚠️ **NEVER commit keystore files to Git**
- ⚠️ **NEVER commit `gradle.properties` with passwords to Git**
- ✅ Add to `.gitignore`:
```
# Keystore files
*.keystore
*.jks

# Gradle properties
gradle.properties
```

### **API URL:**
Make sure your API URL in `.env` or config is accessible from mobile device:
```
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8080/api/v1
# NOT localhost! Use actual IP address
```

Find your IP:
```bash
# Linux/Mac
ifconfig | grep "inet "
# Or
ip addr show

# Windows
ipconfig
```

---

## ✅ Verification Checklist

Before distributing your APK:

- [ ] App launches successfully
- [ ] Login works
- [ ] API calls work (check API URL)
- [ ] Camera/Gallery permissions work
- [ ] Maps work
- [ ] File uploads work
- [ ] Crash logger works (check Settings > Diagnostics)
- [ ] App doesn't crash on back button
- [ ] All screens load correctly

---

## 🚀 Next Steps

After successful build:

1. **Share APK** - Send to testers via email, Google Drive, etc.
2. **Install on multiple devices** - Test on different Android versions
3. **Collect crash logs** - Use Settings > Diagnostics > Share Logs
4. **Iterate and improve** - Fix bugs, add features
5. **Prepare for Play Store** - Generate signed AAB for production

---

## 📚 Additional Resources

- **Expo Build Docs:** https://docs.expo.dev/build/introduction/
- **Android Developer Docs:** https://developer.android.com/studio/build
- **EAS Build:** https://docs.expo.dev/build/setup/

---

**Happy Building! 🎉**

If you encounter issues not covered here, check the crash logs in Settings > Diagnostics or run `adb logcat` for detailed error messages.
