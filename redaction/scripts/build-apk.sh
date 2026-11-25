#!/usr/bin/env bash
# Construit l'APK signée et la copie dans ../apk/Redaction.apk
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
npx cap sync android
(cd android && ./gradlew assembleRelease --no-daemon -q)
mkdir -p ../apk
cp android/app/build/outputs/apk/release/app-release.apk ../apk/Redaction.apk
echo "APK prête : apk/Redaction.apk"
