#!/bin/bash
set -euo pipefail
mkdir -p android-app/test-evidence
trap 'adb logcat -d > android-app/test-evidence/logcat.txt || true; adb exec-out screencap -p > android-app/test-evidence/screen.png || true' EXIT
curl --fail --location --max-time 90 https://github.com/FlashBA/jianghu-calculator/releases/download/v0.4.0/jianghu-calculator-0.4.0.apk -o /tmp/jianghu-old.apk
adb install /tmp/jianghu-old.apk
adb shell am start -n com.flashba.jianghucalculator/.MainActivity
sleep 3
adb install -r "android-app/artifacts/jianghu-calculator-$VERSION_NAME.apk"
adb shell am force-stop com.flashba.jianghucalculator
adb shell svc wifi disable
adb shell svc data disable
adb shell am start -n com.flashba.jianghucalculator/.MainActivity
for attempt in $(seq 1 30); do
  adb shell uiautomator dump /sdcard/window.xml >/dev/null
  adb pull /sdcard/window.xml android-app/test-evidence/window.xml >/dev/null
  if grep -q '角色图鉴' android-app/test-evidence/window.xml; then
    adb shell dumpsys package com.flashba.jianghucalculator > android-app/test-evidence/package.txt
    grep "versionCode=$VERSION_CODE" android-app/test-evidence/package.txt
    echo 'PASS: v0.4.0 upgrade, encrypted asset startup, home encyclopedia entry'
    exit 0
  fi
  sleep 2
done
echo 'WebView home did not become available' >&2
exit 1
