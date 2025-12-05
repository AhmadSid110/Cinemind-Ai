# 📱 Converting CineRank AI to Android APK

This guide provides step-by-step instructions for converting the CineRank AI web application into an Android APK file.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **Android Studio** - [Download here](https://developer.android.com/studio)
3. **Java Development Kit (JDK)** 11 or higher - [Download here](https://www.oracle.com/java/technologies/downloads/)
4. **Git** - [Download here](https://git-scm.com/)

## 🚀 Method 1: Using Capacitor (Recommended)

Capacitor is the modern, official way to convert web apps to native mobile apps. It's developed by the Ionic team and works great with React.

### Step 1: Install Dependencies

```bash
# Install project dependencies
npm install

# Install Capacitor CLI and core
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android
```

### Step 2: Initialize Capacitor

```bash
# Initialize Capacitor in your project
npx cap init "CineRank AI" "com.cinemind.app" --web-dir=dist
```

When prompted:
- **App name**: CineRank AI
- **App ID**: com.cinemind.app (or your preferred package name)
- **Web asset directory**: dist

### Step 3: Build the Web App

```bash
# Build the web application
npm run build
```

This creates an optimized production build in the `dist` folder.

### Step 4: Add Android Platform

```bash
# Add Android platform
npx cap add android
```

This creates an `android` folder with a native Android project.

### Step 5: Configure Android App

Edit the generated `capacitor.config.json` (or create it if it doesn't exist):

```json
{
  "appId": "com.cinemind.app",
  "appName": "CineRank AI",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": true
  },
  "android": {
    "allowMixedContent": true
  }
}
```

### Step 6: Sync and Open Android Studio

```bash
# Copy web assets to native project
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Step 7: Build APK in Android Studio

1. **Wait for Gradle sync** to complete (this may take a few minutes on first run)
2. **Configure signing** (for release builds):
   - Go to `Build` → `Generate Signed Bundle / APK`
   - Select `APK` and click `Next`
   - Create a new keystore or use an existing one
3. **Build APK**:
   - For **Debug APK**: `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - For **Release APK**: `Build` → `Generate Signed Bundle / APK`
4. **Find your APK**:
   - Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Release: `android/app/build/outputs/apk/release/app-release.apk`

### Step 8: Install APK on Device

```bash
# Using ADB (Android Debug Bridge)
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or transfer the APK file to your Android device and install it manually.

---

## 🎯 Method 2: Using PWA and Trusted Web Activities (Simpler)

If you want a simpler approach without Capacitor, you can use PWA Builder.

### Step 1: Make Your App a PWA

1. Create a `manifest.json` file (see below)
2. Add a service worker
3. Build and deploy your app to a web server (GitHub Pages, Vercel, Netlify, etc.)

### Step 2: Use PWA Builder

1. Go to [PWABuilder.com](https://www.pwabuilder.com/)
2. Enter your deployed app URL
3. Click "Generate" to create Android package
4. Download the generated APK

---

## 📱 Method 3: Using Cordova (Alternative)

Cordova is an older but still viable option.

### Step 1: Install Cordova

```bash
npm install -g cordova
```

### Step 2: Create Cordova Project

```bash
# Create a new Cordova project
cordova create cinemind com.cinemind.app "CineRank AI"
cd cinemind

# Add Android platform
cordova platform add android
```

### Step 3: Copy Your Built Web App

```bash
# Build your React app first
cd /path/to/your/react-app
npm run build

# Copy the build to Cordova's www folder
rm -rf ../cinemind/www/*
cp -r dist/* ../cinemind/www/
```

### Step 4: Build APK

```bash
cd ../cinemind

# Build debug APK
cordova build android

# Build release APK
cordova build android --release
```

The APK will be in `platforms/android/app/build/outputs/apk/`.

---

## 🔧 Common Issues and Solutions

### Issue 1: Android SDK Not Found

**Solution**: Set the `ANDROID_HOME` environment variable:

```bash
# Linux/Mac
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Windows (PowerShell)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\tools;$env:ANDROID_HOME\platform-tools"
```

### Issue 2: Gradle Build Fails

**Solution**: 
1. Open `android/build.gradle` and update Gradle version
2. Clear Gradle cache: `./gradlew clean` (in android folder)
3. Rebuild: `./gradlew assembleDebug`

### Issue 3: App Doesn't Load After Installing

**Solution**:
1. Ensure `capacitor.config.json` has correct `webDir` pointing to `dist`
2. Run `npm run build` before `npx cap sync`
3. Check that all assets are properly bundled

### Issue 4: API Keys Not Working in APK

**Solution**:
1. Use environment variables properly
2. For production, consider using a backend proxy for API keys
3. Never hardcode sensitive keys in client-side code

### Issue 5: Network Requests Fail

**Solution**:
1. Add appropriate permissions in `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

## 📦 Complete Build Script

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "cap:init": "npx cap init",
    "cap:add:android": "npx cap add android",
    "cap:sync": "npm run build && npx cap sync android",
    "cap:open": "npx cap open android",
    "android:build": "npm run build && npx cap sync android && cd android && ./gradlew assembleDebug",
    "android:release": "npm run build && npx cap sync android && cd android && ./gradlew assembleRelease"
  }
}
```

Then build with:
```bash
npm run android:build
```

---

## 🎨 PWA Manifest Configuration

Create `public/manifest.json`:

```json
{
  "name": "CineRank AI",
  "short_name": "CineRank",
  "description": "AI-powered movie and TV show discovery app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#06b6d4",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## ✅ Recommended Approach Summary

**For best results, follow Method 1 (Capacitor):**

```bash
# 1. Install dependencies
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor
npx cap init "CineRank AI" "com.cinemind.app" --web-dir=dist

# 3. Build web app
npm run build

# 4. Add Android platform
npx cap add android

# 5. Sync and open in Android Studio
npx cap sync android
npx cap open android

# 6. In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
# 7. APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [PWA Builder](https://www.pwabuilder.com/)
- [Cordova Documentation](https://cordova.apache.org/docs/en/latest/)

---

## 🔐 Security Notes

1. **Never commit your keystore files** to version control
2. **Use environment variables** for API keys
3. **Consider using a backend proxy** for sensitive API calls
4. **Enable ProGuard/R8** for code obfuscation in release builds
5. **Test thoroughly** before releasing to production

---

## 📱 Testing Your APK

1. **Install on physical device** for best performance testing
2. **Test on multiple Android versions** (8.0+, 10, 11, 12, 13, 14)
3. **Check network connectivity** in various conditions
4. **Test API integrations** thoroughly
5. **Verify UI/UX** on different screen sizes

---

Good luck with your APK build! 🚀
