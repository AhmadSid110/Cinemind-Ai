# 🚀 Quick Start: Convert to APK

This is a simplified guide for quickly converting CineRank AI to an Android APK.

## Prerequisites Setup (One-Time)

### 1. Install Node.js
- Download from: https://nodejs.org/
- Verify: `node --version` (should be v16+)

### 2. Install Android Studio
- Download from: https://developer.android.com/studio
- During installation, make sure to install:
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (AVD)

### 3. Set Environment Variables

**Windows:**
```cmd
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx PATH "%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools"
```

**Mac/Linux:**
```bash
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.bash_profile
echo 'export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools' >> ~/.bash_profile
source ~/.bash_profile
```

## 🎯 Build APK (Simple Steps)

### Option A: Using Pre-configured Scripts (Recommended)

```bash
# 1. Clone and navigate to project
cd Cinerank-ai-final

# 2. Install all dependencies (including Capacitor)
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android

# 3. Initialize Capacitor (first time only)
npx cap init "CineRank AI" "com.cinemind.app" --web-dir=dist

# 4. Build web app and add Android
npm run build
npx cap add android

# 5. Open in Android Studio (builds and syncs automatically)
npm run android:dev
```

**In Android Studio:**
- Wait for Gradle sync (1-3 minutes)
- Click `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- Click "locate" in the notification to find your APK
- APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Command Line Build

```bash
# After steps 1-4 from Option A:

# Build debug APK
npm run android:build

# OR build release APK (requires signing)
npm run android:release
```

## 📱 Install APK on Your Phone

### Method 1: USB Connection
```bash
# Enable USB debugging on your phone first
# Settings → About Phone → Tap "Build Number" 7 times → Developer Options → USB Debugging

# Connect phone via USB and run:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Method 2: Direct Transfer
1. Copy `app-debug.apk` to your phone
2. Open the APK file on your phone
3. Allow installation from unknown sources if prompted
4. Install the app

## 🔄 Update APK After Code Changes

```bash
# 1. Make your code changes
# 2. Rebuild and sync
npm run cap:sync

# 3. Rebuild APK in Android Studio
# OR use command line:
npm run android:build
```

## ⚡ Troubleshooting Quick Fixes

### "SDK not found"
```bash
# Verify Android Studio is installed
# Check ANDROID_HOME is set: echo $ANDROID_HOME
# Install SDK from Android Studio → Tools → SDK Manager
```

### "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
npm run android:build
```

### "Command not found: npx"
```bash
npm install -g npm@latest
```

### App doesn't load after install
```bash
# Rebuild everything from scratch
npm run build
npx cap sync android
npm run android:build
```

## 📦 APK Locations

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`

## 🎨 Customize App

### Change App Name
Edit `capacitor.config.json`:
```json
{
  "appName": "Your App Name"
}
```

### Change Package ID
Edit `capacitor.config.json`:
```json
{
  "appId": "com.yourcompany.yourapp"
}
```

### Change App Icon
Replace icons in `android/app/src/main/res/`:
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

## 🎯 Summary Command (Copy & Paste)

```bash
# Complete setup and build (run once)
npm install && \
npm install @capacitor/core @capacitor/cli @capacitor/android && \
npx cap init "CineRank AI" "com.cinemind.app" --web-dir=dist && \
npm run build && \
npx cap add android && \
npm run cap:sync && \
npx cap open android
```

Then in Android Studio: `Build` → `Build APK(s)`

---

**Need more details?** See the complete guide: [APK_BUILD_GUIDE.md](./APK_BUILD_GUIDE.md)
