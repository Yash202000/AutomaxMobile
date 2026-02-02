# 🚀 Quick Start - Android Build

The fastest way to build your Android APK locally.

---

## ⚡ Super Quick (If you have everything installed)

```bash
cd /home/developer/workstation/Automax/AutomaxMobile

# Run the automated build script
./build-android.sh
```

Select option 1 (Debug APK) for quick testing.

---

## 📋 First Time Setup (5 minutes)

### 1. Install Java 17
```bash
sudo apt update
sudo apt install openjdk-17-jdk
java -version  # Should show 17.x.x
```

### 2. Install Android Studio
Download from: https://developer.android.com/studio

**After installation:**
- Open Android Studio
- Go to: Settings > Android SDK
- Install: Android 13 (API 33) and Android 14 (API 34)
- Install: SDK Build-Tools, Command-line Tools, Platform-Tools

### 3. Set Environment Variables
Add to `~/.bashrc` or `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

Apply changes:
```bash
source ~/.bashrc  # or ~/.zshrc
```

Verify:
```bash
adb --version  # Should show version
```

### 4. Install Dependencies
```bash
cd /home/developer/workstation/Automax/AutomaxMobile
npm install
```

---

## 🏗️ Build Your First APK

### Method 1: Using the Build Script (Recommended)

```bash
./build-android.sh
```

Select option 1 for Debug APK. Done! ✅

### Method 2: Manual Commands

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build Debug APK
cd android
./gradlew assembleDebug

# APK is at: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Install on Your Device

### Via USB:
1. Enable **Developer Options** on your Android phone:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
2. Enable **USB Debugging**:
   - Settings > Developer Options > USB Debugging
3. Connect phone to computer via USB
4. Allow USB debugging on phone
5. Install:

```bash
cd /home/developer/workstation/Automax/AutomaxMobile
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Via File Transfer:
1. Copy APK from `android/app/build/outputs/apk/debug/app-debug.apk`
2. Transfer to phone (Google Drive, Email, USB)
3. Open APK on phone
4. Allow "Install from Unknown Sources" if prompted
5. Tap "Install"

---

## 🎯 Build Options

### Debug APK (For Testing)
- **Fast build** (~2-5 minutes)
- **Larger size** (~50-80 MB)
- **Not optimized**
- **Use for**: Development and testing

```bash
./build-android.sh  # Select option 1
```

### Release APK (For Distribution)
- **Slower build** (~5-10 minutes)
- **Smaller size** (~20-40 MB)
- **Optimized and minified**
- **Use for**: Sharing with users, production

**First, generate keystore:**
```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore automax-release-key.keystore \
  -alias automax-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

Enter a password (remember it!), then:
```bash
cp automax-release-key.keystore android/app/
./build-android.sh  # Select option 2
```

---

## ⚙️ Important Configuration

### API URL
Before building, update your API URL in the code to use your computer's IP address (not localhost):

Find your IP:
```bash
# Linux/Mac
hostname -I | awk '{print $1}'

# Or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Update in `src/api/client.ts`:
```typescript
export const baseURL = 'http://YOUR_IP_ADDRESS:8080/api/v1';
// Example: http://192.168.1.100:8080/api/v1
```

---

## 🐛 Common Issues

### "ANDROID_HOME not set"
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### "SDK location not found"
Create `android/local.properties`:
```
sdk.dir=/home/yourusername/Android/Sdk
```

### "Java version not compatible"
```bash
java -version  # Should be 17.x.x
# If not, install JDK 17
sudo apt install openjdk-17-jdk
```

### APK installs but crashes
Check logs:
```bash
adb logcat | grep "AndroidRuntime"
```

Rebuild:
```bash
./build-android.sh  # Select option 3 (Clean), then option 1 (Build)
```

---

## 📊 Build Script Options

When you run `./build-android.sh`:

1. **Debug APK** - Fast build for testing
2. **Release APK** - Optimized for distribution
3. **Clean build** - Remove previous builds and caches
4. **Install APK** - Install existing APK on connected device
5. **Exit**

---

## ✅ Checklist Before Sharing APK

- [ ] App opens successfully
- [ ] Login works
- [ ] API calls work (check API URL is your computer's IP)
- [ ] Camera/Gallery permissions work
- [ ] Maps display correctly
- [ ] Create incident works
- [ ] View incident details works
- [ ] Crash logging works (Settings > Diagnostics)

---

## 📚 Need More Details?

See the complete guide: **`ANDROID_BUILD_GUIDE.md`**

---

## 🆘 Getting Help

**View device logs:**
```bash
adb logcat
```

**View app-specific logs:**
```bash
adb logcat | grep "AutomaxMobile"
```

**Check crash logs in app:**
Settings > Diagnostics > Share Logs

---

**Happy Building! 🎉**

Your APK will be at:
- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android/app/build/outputs/apk/release/app-release.apk`
