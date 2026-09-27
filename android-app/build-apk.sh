#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
APP_DIR="$ROOT_DIR/android-app"
BUILD_DIR="$APP_DIR/build"
ASSET_DIR="$APP_DIR/src/main/assets"
SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}
VERSION_CODE=${VERSION_CODE:-2}
VERSION_NAME=${VERSION_NAME:-0.1.1}
KEYSTORE=${APK_KEYSTORE:-$BUILD_DIR/jianghu-debug.keystore}
STORE_PASSWORD=${APK_STORE_PASSWORD:-android}
KEY_ALIAS=${APK_KEY_ALIAS:-androiddebugkey}
KEY_PASSWORD=${APK_KEY_PASSWORD:-$STORE_PASSWORD}
OUTPUT_APK="$APP_DIR/artifacts/jianghu-calculator-$VERSION_NAME.apk"
JAVA_HOME=${JAVA_HOME:-}
if [ -z "$JAVA_HOME" ] && [ -x /usr/libexec/java_home ]; then
  JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || true)
fi
if [ -z "$JAVA_HOME" ]; then
  echo "Set JAVA_HOME to a JDK 17 installation before building." >&2
  exit 1
fi
PLATFORM="$SDK_ROOT/platforms/android-35/android.jar"
BUILD_TOOLS="$SDK_ROOT/build-tools/35.0.0"
JAVAC="$JAVA_HOME/bin/javac"
JAVA="$JAVA_HOME/bin/java"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

for required in "$JAVAC" "$JAVA" "$PLATFORM" "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" "$BUILD_TOOLS/apksigner" "$BUILD_TOOLS/zipalign"; do
  if [ ! -e "$required" ]; then
    echo "Missing build dependency: $required" >&2
    exit 1
  fi
done

rm -rf "$BUILD_DIR/classes" "$BUILD_DIR/tool-classes" "$BUILD_DIR/dex" "$BUILD_DIR/generated" "$BUILD_DIR/res" "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk" "$BUILD_DIR/signed.apk"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/tool-classes" "$BUILD_DIR/dex" "$BUILD_DIR/generated" "$BUILD_DIR/res" "$APP_DIR/artifacts" "$ASSET_DIR"

# Keep only the encrypted vault in the APK assets directory. Plaintext web files
# may be left there by an older build, so remove these exact generated files first.
rm -f "$ASSET_DIR/index.html" "$ASSET_DIR/app.js" "$ASSET_DIR/style.css" \
  "$ASSET_DIR/uc540_doc.json" "$ASSET_DIR/whiterabbit_data.json" "$ASSET_DIR/app.vault"

"$JAVAC" --release 8 -d "$BUILD_DIR/tool-classes" \
  "$APP_DIR/tools/AssetVaultBuilder.java"
"$JAVA" -cp "$BUILD_DIR/tool-classes" com.flashba.jianghucalculator.AssetVaultBuilder \
  "$ASSET_DIR/app.vault" \
  "$BUILD_DIR/generated/com/flashba/jianghucalculator/AssetVaultKey.java" \
  "index.html=$ROOT_DIR/web/index.html" \
  "app.js=$ROOT_DIR/web/app.js" \
  "style.css=$ROOT_DIR/web/style.css" \
  "uc540_doc.json=$ROOT_DIR/web/uc540_doc.json" \
  "whiterabbit_data.json=$ROOT_DIR/web/whiterabbit_data.json"

"$JAVAC" --release 8 -classpath "$PLATFORM" -d "$BUILD_DIR/classes" \
  "$APP_DIR/src/main/java/com/flashba/jianghucalculator/MainActivity.java" \
  "$BUILD_DIR/generated/com/flashba/jianghucalculator/AssetVaultKey.java"
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 23 --output "$BUILD_DIR/dex" \
  "$BUILD_DIR/classes/com/flashba/jianghucalculator/"*.class

"$BUILD_TOOLS/aapt2" compile --dir "$APP_DIR/src/main/res" -o "$BUILD_DIR/res/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$PLATFORM" \
  --manifest "$APP_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/generated" \
  -A "$ASSET_DIR" \
  --min-sdk-version 23 \
  --target-sdk-version 35 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  -o "$BUILD_DIR/unsigned.apk" \
  "$BUILD_DIR/res/resources.zip"

cp "$BUILD_DIR/dex/classes.dex" "$BUILD_DIR/classes.dex"
zip -q -j "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/classes.dex"
rm -f "$BUILD_DIR/classes.dex"

if [ ! -f "$KEYSTORE" ]; then
  echo "Missing signing keystore: $KEYSTORE" >&2
  echo "Set APK_KEYSTORE to the same keystore used by the installed APK." >&2
  exit 1
fi

"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass "pass:$STORE_PASSWORD" --ks-key-alias "$KEY_ALIAS" \
  --key-pass "pass:$KEY_PASSWORD" --out "$BUILD_DIR/signed.apk" "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose "$BUILD_DIR/signed.apk"
cp "$BUILD_DIR/signed.apk" "$OUTPUT_APK"

echo "APK: $OUTPUT_APK"
ls -lh "$OUTPUT_APK"
