#!/usr/bin/env bash
# Builds the web app and creates/updates the native iOS and Android projects.
#   bash scripts/native-setup.sh android|ios|all
# The android/ and ios/ folders are generated, so they are not committed; CI recreates them on every build.
# Optional env: BUILD_NUMBER (must go up with every store upload; CI uses the run number).
set -euo pipefail
PLATFORM=${1:-all}
VERSION=$(node -p "require('./package.json').version")
BUILD=${BUILD_NUMBER:-1}

npm run build
want() { [[ $PLATFORM == all || $PLATFORM == "$1" ]]; }
want android && { [ -d android ] || npx cap add android; }
want ios && { [ -d ios ] || npx cap add ios; }

# App icons and splash screens from assets/*.png
if [[ $PLATFORM == all ]]; then npm run assets; else npm run assets -- --$PLATFORM; fi
if [[ $PLATFORM == all ]]; then npx cap sync; else npx cap sync $PLATFORM; fi

if want android; then
  sed -i.bak -E "s/versionCode [0-9]+/versionCode $BUILD/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" android/app/build.gradle
  rm -f android/app/build.gradle.bak
  grep -E "versionCode|versionName" android/app/build.gradle
fi

if want ios && command -v plutil >/dev/null && [[ $(uname) == Darwin ]]; then
  PLIST=ios/App/App/Info.plist
  plutil -replace ITSAppUsesNonExemptEncryption -bool NO "$PLIST"   # skips the export-compliance question on every upload
  plutil -replace NSCameraUsageDescription -string "Take a photo of your pizza to save with the recipe." "$PLIST"
  plutil -replace NSPhotoLibraryUsageDescription -string "Choose a photo of your pizza to save with the recipe." "$PLIST"
fi
echo "Native project ready (version $VERSION, build $BUILD)"
