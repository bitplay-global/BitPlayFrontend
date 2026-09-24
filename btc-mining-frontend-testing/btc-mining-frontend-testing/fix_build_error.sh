#!/bin/bash
set -e

echo "🚀 Starting Deep Clean & Fix..."

# 1. Clear Watchman (Critical for Invariant Violations)
if command -v watchman &> /dev/null; then
    echo "🧹 Clearing Watchman..."
    watchman watch-del-all || true
else
    echo "⚠️ Watchman not found, skipping..."
fi

# 2. Delete Metro Cache (Temporary files that cause stale bundles)
echo "🧹 Deleting Metro Cache..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/haste-map-*

# 3. Clean Android Build
echo "🧹 Cleaning Android Build..."
cd android
./gradlew clean
cd ..

# 4. Clean iOS Pods (fixes react-native-screens "bottom-tabs" path after package updates)
echo "🧹 Cleaning iOS Pods..."
rm -rf ios/Pods ios/Podfile.lock ios/build
cd ios && pod install --repo-update && cd ..

echo "✅ Clean Complete!"
echo "-----------------------------------"
echo "👉 NOW RUN THESE COMMANDS IN SEPARATE TERMINALS:"
echo "1. npm start -- --reset-cache"
echo "2. npm run android"
echo "-----------------------------------"


# ./gradlew assembleDebug

# echo "📍 APK location: adb install app/build/outputs/apk/debug/app-debug.apk"
#for debug app

# adb install app-debug.apk



# 4 Build Release APK

# ./gradlew assembleRelease 
# echo "📍 APK location: adb install app/build/outputs/apk/release/app-release.apk"


# ✅ Want AAB instead of APK? (Play Store)
 
# ./gradlew bundleRelease


# android/app/build/outputs/bundle/release/app-release.aab

# List all devices (physical and simulators):
# xcrun xctrace list devices

#List connected physical devices and simulators using simctl:
# xcrun simctl list devices


# npx react-native run-ios --simulator="iPhone 14"
# npx react-native run-ios --device="Max's iPhone"


# cd android/app/build/outputs/bundle/release 


# - `adb reverse tcp:3001 tcp:3001` (for Android emulator)
# - `adb reverse tcp:5001 tcp:5001` (for Android emulator)


xcrun xctrace list devices
