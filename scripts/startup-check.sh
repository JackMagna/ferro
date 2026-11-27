#!/usr/bin/env bash
# Prova di avvio sull'emulatore: installa gli APK delle release una sopra l'altra e salva logcat e schermate.
set -x
OUT=startup-check; mkdir -p $OUT
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1; adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" > "$OUT/$1.activity.txt"; }
tap_text() { # tocca il primo elemento con questo testo
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1
  xy=$(python3 -c "
import re,sys
x=open('/tmp/ui.xml').read()
for n in re.findall(r'<node [^>]*>', x):
    if sys.argv[1].lower() in n.lower():
        a=list(map(int,re.findall(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n)[0])); print((a[0]+a[2])//2,(a[1]+a[3])//2); break
" "$1")
  [ -n "$xy" ] && adb shell input tap $xy
}
launch() { adb shell am force-stop it.irontrack.app; adb shell monkey -p it.irontrack.app -c android.intent.category.LAUNCHER 1; }
run() { # nome, apk...
  name=$1; shift
  adb logcat -b all -c
  adb uninstall it.irontrack.app || true
  adb logcat -c
  first=1
  for apk in "$@"; do
    v=$(basename $apk .apk)
    adb install -r $apk
    launch; shot "$name-$v-a" 15
    if [ $first = 1 ]; then tap_text "senza account"; tap_text "without an account"; shot "$name-$v-guest" 15; echo "== guest $name"; grep -o 'text="[^"]\{3,40\}"' $OUT/$name-$v-guest.xml | head -15; first=0; fi
    launch; shot "$name-$v-b" 20
  done
  adb logcat -d > "$OUT/$name.logcat.txt"
  echo "===== $name: crash"; adb logcat -b crash -d | tail -60
  echo "===== $name: activity"; cat $OUT/$name-*.activity.txt
  grep -E "AndroidRuntime|FATAL|Capacitor|chromium|Console|ferro|irontrack" "$OUT/$name.logcat.txt" > "$OUT/$name.filtered.txt" || true
}
# dopo ogni avvio: testi sullo schermo (si vede se l'app è aperta)

run fresh-new apk/new.apk
run up260-new apk/v2.6.0.apk apk/new.apk
run up261-new apk/v2.6.1.apk apk/new.apk
for f in $OUT/*-new-b.xml; do echo "== testi $f"; grep -o 'text="[^"]\{3,40\}"' $f | head -12; done
echo "== crash totali"; grep -c "FATAL EXCEPTION" $OUT/*.logcat.txt || true
