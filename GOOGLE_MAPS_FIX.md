# Google Maps Blank Screen Fix

Your Google Maps are showing blank because the API key needs proper configuration.

---

## ✅ **Fixes Applied**

I've already fixed:
1. ✅ **Recursive crash logger error** - Infinite loop fixed
2. ✅ **Location permission config** - Added expo-location plugin
3. ✅ **Google Maps API key config** - Added to app.json

---

## 🔨 **Steps to Fix Blank Maps**

### **Step 1: Configure Google Maps API Key in Google Cloud**

Your API key: `AIzaSyBNEDC659drKfsx1-xwI0mm2PzeNBHs_4o`

**Go to Google Cloud Console:**
1. Visit: https://console.cloud.google.com/google/maps-apis/credentials

2. **Find your API key** (the one above) in the list

3. **Click on the API key** to edit it

4. **Enable these APIs:**
   - Click "Enable APIs and Services"
   - Search and enable:
     - ✅ **Maps SDK for Android**
     - ✅ **Maps JavaScript API** (optional, for web)
     - ✅ **Geocoding API** (if using address lookup)
     - ✅ **Places API** (if using place search)

5. **Set API Restrictions** (for security):
   - Under "API restrictions"
   - Select "Restrict key"
   - Check: "Maps SDK for Android"
   - Save

6. **Set Application Restrictions**:
   - Under "Application restrictions"
   - Select "Android apps"
   - Click "Add an item"
   - **Package name**: `com.automax.mobile`
   - **SHA-1 fingerprint**: Get it from step 2 below
   - Save

---

### **Step 2: Get Your SHA-1 Fingerprint**

**For Debug Builds:**
```bash
cd /home/developer/workstation/Automax/AutomaxMobile/android

# Get debug SHA-1
keytool -list -v -keystore app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Copy the SHA1 line (looks like: A1:B2:C3:D4:E5:F6...)
```

**For Release Builds:**
```bash
# If you have a release keystore
keytool -list -v -keystore app/automax-release-key.keystore -alias automax-key-alias

# Copy the SHA1 line
```

**Add SHA-1 to Google Cloud Console:**
1. Go back to your API key settings
2. Under "Application restrictions" > "Android apps"
3. Add the SHA-1 fingerprint you copied
4. Save

---

### **Step 3: Rebuild Native Code**

After configuring the API key, you MUST rebuild:

```bash
cd /home/developer/workstation/Automax/AutomaxMobile

# Clean and rebuild native modules
npx expo prebuild --clean

# Rebuild APK
cd android
./gradlew clean
./gradlew assembleDebug

# Install
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

### **Step 4: Test Location Permission**

When the app first tries to use location/maps, it should prompt for permission:

1. Open the app
2. Navigate to a screen with maps
3. **You should see**: "Allow AutomaxMobile to use your location?"
4. **Tap**: "While using the app" or "Allow"

**If permission prompt doesn't appear:**
```bash
# Manually grant permission
adb shell pm grant com.automax.mobile android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.automax.mobile android.permission.ACCESS_COARSE_LOCATION
```

---

## 🐛 **Troubleshooting**

### **Maps Still Blank After Config?**

**Check API Key Status:**
```bash
# Test if API key is valid
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=AIzaSyBNEDC659drKfsx1-xwI0mm2PzeNBHs_4o"

# Should return JSON with results, not an error
```

**Common Issues:**

1. **"This API project is not authorized"**
   - Enable "Maps SDK for Android" in Google Cloud Console
   - Wait 5-10 minutes for changes to propagate

2. **"The provided API key is invalid"**
   - Check if API key is correct in AndroidManifest.xml
   - Check if API key is enabled (not disabled)

3. **"Maps SDK for Android has not been used"**
   - Enable the API in Google Cloud Console
   - Billing must be enabled (free tier is available)

4. **Maps show but are grey/blank**
   - Add SHA-1 fingerprint to API key restrictions
   - Remove any IP restrictions (not applicable for Android)

---

## 🔍 **Verify Configuration**

### **Check AndroidManifest.xml:**
```bash
cat android/app/src/main/AndroidManifest.xml | grep "API_KEY"
```

Should show:
```xml
<meta-data android:name="com.google.android.geo.API_KEY" android:value="AIzaSyBNEDC659drKfsx1-xwI0mm2PzeNBHs_4o"/>
```

### **Check app.json:**
```bash
cat app.json | grep -A 3 "googleMaps"
```

Should show:
```json
"googleMaps": {
  "apiKey": "AIzaSyBNEDC659drKfsx1-xwI0mm2PzeNBHs_4o"
}
```

### **Test Location Permission:**
```bash
# Check if permission is granted
adb shell dumpsys package com.automax.mobile | grep -A 3 "android.permission.ACCESS"

# Should show: granted=true
```

---

## 📱 **Quick Test**

1. **Grant location permission manually:**
   ```bash
   adb shell pm grant com.automax.mobile android.permission.ACCESS_FINE_LOCATION
   ```

2. **Clear app data (fresh start):**
   ```bash
   adb shell pm clear com.automax.mobile
   ```

3. **Reinstall app:**
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Open app and navigate to maps**

5. **Check logs for errors:**
   ```bash
   adb logcat | grep -E "Maps|Location|Permission"
   ```

---

## ✅ **Expected Result**

After proper configuration:
- ✅ Maps load correctly (not blank/grey)
- ✅ Location permission prompt appears when needed
- ✅ User location shows on map (blue dot)
- ✅ No API key errors in logs

---

## 💰 **Google Maps Pricing**

**Free Tier (No credit card needed for development):**
- 28,000 map loads per month FREE
- 40,000 geocoding requests per month FREE

**For Production:**
- You'll need to enable billing
- But free tier covers most small apps
- Only charged if you exceed free limits

---

## 🎯 **Summary - What You Need to Do**

1. **Enable APIs in Google Cloud Console:**
   - Maps SDK for Android ✅
   - (Optional) Geocoding API
   - (Optional) Places API

2. **Configure API Key:**
   - Add package name: `com.automax.mobile`
   - Add SHA-1 fingerprint (get from `keytool` command above)
   - Restrict to "Maps SDK for Android"

3. **Rebuild:**
   ```bash
   npx expo prebuild --clean
   cd android
   ./gradlew clean assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Grant location permission when prompted**

---

## 🆘 **Still Having Issues?**

Run these diagnostics:

```bash
# Check API key configuration
cat android/app/src/main/AndroidManifest.xml | grep -A 1 "API_KEY"

# Check permissions
cat android/app/src/main/AndroidManifest.xml | grep "LOCATION"

# Get SHA-1 for debug
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1

# Test location permission
adb shell pm grant com.automax.mobile android.permission.ACCESS_FINE_LOCATION

# View maps-related logs
adb logcat | grep -i "maps"
```

Send me the output if maps are still blank!

---

**The fixes are ready. Just configure the API key in Google Cloud Console and rebuild!** 🚀
