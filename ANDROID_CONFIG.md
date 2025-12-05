# 🤖 Android-Specific Configuration

This document contains Android-specific configurations and customizations for the CineRank AI app.

## 📋 Default Configuration

The project is pre-configured with the following defaults:

- **App Name**: CineRank AI
- **Package ID**: com.cinemind.app
- **Theme Color**: #06b6d4 (cyan)
- **Background Color**: #020617 (dark)
- **Orientation**: Portrait (primary)

## 🎨 Customization

### 1. Change App Name

Edit `capacitor.config.json`:
```json
{
  "appName": "Your Custom Name"
}
```

### 2. Change Package ID

Edit `capacitor.config.json`:
```json
{
  "appId": "com.yourcompany.yourapp"
}
```

**Note**: Package ID should follow reverse domain format (e.g., com.company.appname)

### 3. Change App Icon

After running `npx cap add android`, replace icons in:
```
android/app/src/main/res/
├── mipmap-hdpi/ic_launcher.png (72x72)
├── mipmap-mdpi/ic_launcher.png (48x48)
├── mipmap-xhdpi/ic_launcher.png (96x96)
├── mipmap-xxhdpi/ic_launcher.png (144x144)
└── mipmap-xxxhdpi/ic_launcher.png (192x192)
```

**Tip**: Use https://icon.kitchen/ to generate all required sizes

### 4. Change Splash Screen

Edit `android/app/src/main/res/values/styles.xml`:
```xml
<style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
    <item name="android:background">@drawable/splash</item>
</style>
```

Add your splash image to: `android/app/src/main/res/drawable/splash.png`

### 5. Change Theme Colors

Edit `android/app/src/main/res/values/colors.xml`:
```xml
<resources>
    <color name="colorPrimary">#06b6d4</color>
    <color name="colorPrimaryDark">#0891b2</color>
    <color name="colorAccent">#3b82f6</color>
</resources>
```

## 🔐 Permissions

Default permissions in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Add Camera Permission (if needed)
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

### Add Storage Permission (if needed)
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## 🏗️ Build Types

### Debug Build
- For testing and development
- No signing required
- Larger file size
- Includes debug symbols

```bash
npm run android:build
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build
- For production/distribution
- Requires code signing
- Optimized and minified
- Smaller file size

```bash
npm run android:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## 🔑 Code Signing (Release Builds)

### Step 1: Generate Keystore

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

### Step 2: Configure Gradle

Create `android/key.properties`:
```properties
storePassword=yourStorePassword
keyPassword=yourKeyPassword
keyAlias=my-key-alias
storeFile=../my-release-key.keystore
```

### Step 3: Update build.gradle

Edit `android/app/build.gradle`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**⚠️ IMPORTANT**: Never commit `key.properties` or keystore files to Git!

Add to `.gitignore`:
```
*.keystore
*.jks
key.properties
```

## 📦 App Bundle (AAB) for Play Store

For Google Play Store submission, use Android App Bundle (.aab):

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## 🚀 Performance Optimization

### Enable ProGuard/R8 (Code Shrinking)

Edit `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### Enable MultiDex (if needed)

If you get "too many methods" error:

```gradle
android {
    defaultConfig {
        multiDexEnabled true
    }
}

dependencies {
    implementation 'androidx.multidex:multidex:2.0.1'
}
```

## 🌐 Network Configuration

### Allow HTTP (Not Recommended)

Edit `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
```

Reference in `AndroidManifest.xml`:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

## 📱 Target Android Versions

Edit `android/app/build.gradle`:
```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 22  // Android 5.1+
        targetSdkVersion 34  // Android 14
    }
}
```

**Recommendation**:
- minSdkVersion: 22 (covers 95%+ devices)
- targetSdkVersion: 34 (latest stable)

## 🐛 Debugging

### Enable Chrome DevTools

1. Build and install debug APK
2. Open Chrome: `chrome://inspect`
3. Select your device
4. Click "inspect" on your app

### View Logs

```bash
# View all logs
adb logcat

# Filter by app
adb logcat | grep "Capacitor"

# Clear logs
adb logcat -c
```

### Debug Mode

In `capacitor.config.json`:
```json
{
  "server": {
    "url": "http://192.168.1.100:3000",
    "cleartext": true
  }
}
```

Then run:
```bash
npm run dev  # In one terminal
npx cap sync android  # In another terminal
```

## 📊 App Size

Typical sizes:
- **Debug APK**: 15-25 MB
- **Release APK (unoptimized)**: 10-20 MB
- **Release APK (optimized)**: 5-15 MB
- **App Bundle**: 4-10 MB

## ✅ Pre-Release Checklist

- [ ] Update version in `android/app/build.gradle`
- [ ] Test on multiple Android versions (8, 10, 12, 14)
- [ ] Test on different screen sizes
- [ ] Verify all API integrations work
- [ ] Check network connectivity edge cases
- [ ] Test offline functionality (if any)
- [ ] Verify app icons display correctly
- [ ] Test installation and uninstallation
- [ ] Check app permissions
- [ ] Review ProGuard rules
- [ ] Sign with release keystore
- [ ] Generate release build
- [ ] Test release build on device

## 🔗 Useful Commands

```bash
# List connected devices
adb devices

# Install APK
adb install path/to/app.apk

# Uninstall app
adb uninstall com.cinemind.app

# Take screenshot
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png

# Record screen
adb shell screenrecord /sdcard/demo.mp4
adb pull /sdcard/demo.mp4

# Clear app data
adb shell pm clear com.cinemind.app

# View installed packages
adb shell pm list packages | grep cinemind

# Check app size
adb shell pm path com.cinemind.app
```

## 📚 Additional Resources

- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Android Developer Guide](https://developer.android.com/guide)
- [Material Design Guidelines](https://material.io/design)
- [Play Store Publishing Guide](https://support.google.com/googleplay/android-developer/answer/9859152)

---

For general APK build instructions, see [APK_BUILD_GUIDE.md](./APK_BUILD_GUIDE.md)
