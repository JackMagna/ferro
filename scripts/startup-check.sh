#!/usr/bin/env bash
# Prova di avvio sull'emulatore: installa gli APK delle release una sopra l'altra e salva logcat e schermate.
set -x
OUT=startup-check; mkdir -p $OUT
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1; adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" > "$OUT/$1.activity.txt"; }
tap_text() { # tocca il primo elemento con questo testo
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1
  b=$(grep -o "text=\"[^\"]*$1[^\"]*\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" /tmp/ui.xml | head -1 | grep -o '\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]' | tr -d '[]' | tr ',' ' ')
  [ -n "$b" ] && set -- $b && adb shell input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 ))
}
launch() { adb shell am force-stop it.irontrack.app; adb shell monkey -p it.irontrack.app -c android.intent.category.LAUNCHER 1; }
run() { # nome, apk...
  name=$1; shift
  adb uninstall it.irontrack.app || true
  adb logcat -c
  first=1
  for apk in "$@"; do
    v=$(basename $apk .apk)
    adb install -r $apk
    launch; shot "$name-$v-a" 15
    if [ $first = 1 ]; then tap_text "senza account"; tap_text "without an account"; shot "$name-$v-guest" 8; first=0; fi
    launch; shot "$name-$v-b" 20
  done
  adb logcat -d > "$OUT/$name.logcat.txt"
  grep -E "AndroidRuntime|FATAL|Capacitor|chromium|Console|ferro|irontrack" "$OUT/$name.logcat.txt" > "$OUT/$name.filtered.txt" || true
}
run fresh261 apk/v2.6.1.apk
run up260to261 apk/v2.6.0.apk apk/v2.6.1.apk
run up252to261 apk/v2.5.2.apk apk/v2.6.1.apk
