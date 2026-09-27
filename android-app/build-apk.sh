#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
APP_DIR="$ROOT_DIR/android-app"
BUILD_DIR="$APP_DIR/build"
ASSET_DIR="$APP_DIR/src/main/assets"
SDK_ROOT=${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}
JAVA_HOME=${JAVA_HOME:-/private/tmp/temurin17-root/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home}
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

rm -rf "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/generated" "$BUILD_DIR/res" "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk" "$BUILD_DIR/signed.apk"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/generated" "$BUILD_DIR/res" "$APP_DIR/artifacts" "$ASSET_DIR"

cp "$ROOT_DIR/web/index.html" "$ROOT_DIR/web/app.js" "$ROOT_DIR/web/style.css" \
  "$ROOT_DIR/web/uc540_doc.json" "$ROOT_DIR/web/whiterabbit_data.json" "$ASSET_DIR/"

"$JAVAC" --release 8 -classpath "$PLATFORM" -d "$BUILD_DIR/classes" \
  "$APP_DIR/src/main/java/com/flashba/jianghucalculator/MainActivity.java"
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 23 --output "$BUILD_DIR/dex" \
  "$BUILD_DIR/classes/com/flashba/jianghucalculator/MainActivity.class"

"$BUILD_TOOLS/aapt2" compile --dir "$APP_DIR/src/main/res" -o "$BUILD_DIR/res/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$PLATFORM" \
  --manifest "$APP_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/generated" \
  -A "$ASSET_DIR" \
  --min-sdk-version 23 \
  --target-sdk-version 35 \
  --version-code 1 \
  --version-name 0.1.0 \
  -o "$BUILD_DIR/unsigned.apk" \
  "$BUILD_DIR/res/resources.zip"

cp "$BUILD_DIR/dex/classes.dex" "$BUILD_DIR/classes.dex"
zip -q -j "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/classes.dex"
rm -f "$BUILD_DIR/classes.dex"

KEYSTORE="$BUILD_DIR/jianghu-debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -noprompt \
    -keystore "$KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US"
fi

"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$BUILD_DIR/signed.apk" "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose "$BUILD_DIR/signed.apk"
cp "$BUILD_DIR/signed.apk" "$APP_DIR/artifacts/jianghu-calculator-0.1.0.apk"

echo "APK: $APP_DIR/artifacts/jianghu-calculator-0.1.0.apk"
ls -lh "$APP_DIR/artifacts/jianghu-calculator-0.1.0.apk"
