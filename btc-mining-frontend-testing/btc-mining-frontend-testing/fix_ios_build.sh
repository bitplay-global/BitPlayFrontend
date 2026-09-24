# 1) go to ios
cd ios || exit 1

# 2) ensure Podfile uses fixed platform (force iOS 15.1 if your Podfile still uses the react-native var)
# (This will modify your Podfile in-place if needed; it is safe. If you already have platform :ios, '15.1' skip)
if ! grep -E "platform\s*:ios\s*,\s*'15\.1'" Podfile >/dev/null 2>&1; then
  echo "Patching Podfile to set platform :ios, '15.1'..."
  # make a backup first
  cp Podfile Podfile.backup.$(date +%s)
  # replace a line that contains platform :ios, min_ios_version_supported (if exists) or add platform at top
  if grep -q "min_ios_version_supported" Podfile; then
    sed -i '' "s/platform :ios.*/platform :ios, '15.1'/" Podfile
  else
    # insert platform at top after any initial require lines
    awk 'NR==1{print; next} NR==2{print \"platform :ios, \\04715.1\\047\"; print; next} {print}' Podfile > Podfile.tmp && mv Podfile.tmp Podfile
  fi
fi

# 3) remove Pods and pod lock and cached stuff
pod deintegrate >/dev/null 2>&1 || true
rm -rf Pods Podfile.lock build

# 4) search & remove phantom references from Target Support Files (scripts + xcfilelists)
SUPPORT_DIR="Pods/Target Support Files"
echo "Cleaning Target Support Files for phantom privacy bundles..."
# remove lines referencing glog_privacy or RCT-Folly_privacy from resource scripts
find "$SUPPORT_DIR" -type f -name '*-resources.sh' -print0 | xargs -0 -I{} sed -i '' '/glog_privacy/d; /RCT-Folly_privacy/d' {}
# remove lines from xcfilelists
find "$SUPPORT_DIR" -type f -name '*.xcfilelist' -print0 | xargs -0 -I{} sed -i '' '/glog_privacy/d; /RCT-Folly_privacy/d' {}

# 5) re-install pods cleanly (force repo update)
pod install --repo-update

# 6) completely clear derived data for this project only (no root)
echo "Removing DerivedData for this project..."
rm -rf ~/Library/Developer/Xcode/DerivedData/BitcoinMining-*

# 7) clean caches CocoaPods (optional but helpful)
pod cache clean --all >/dev/null 2>&1 || true

# 8) (optional) build once from command line to capture full log
# echo "Starting xcodebuild (this may take a while)..."
# xcodebuild \
#   -workspace /ios/BitcoinMining.xcworkspace \
#   -scheme BitcoinMining \
#   -configuration Debug \
#   -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.5' \
#   clean build | tee ../ios-build.log

echo "Nuke Complete!!"
