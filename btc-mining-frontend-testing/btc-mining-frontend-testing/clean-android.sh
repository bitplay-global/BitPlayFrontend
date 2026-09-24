#!/bin/bash

set -e  # stop script if any command fails

echo "Cleaning Android React Native build..."

# 1. Remove node modules and build artifacts
rm -rf node_modules
rm -f package-lock.json
rm -rf android/app/build android/.cxx android/build

echo "Removed old build files."

# 2. Reinstall dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# 3. Clean Gradle
echo "Cleaning Gradle..."
cd android
./gradlew clean

echo "Build finished successfully!"
