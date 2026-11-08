#!/usr/bin/env bash
# ساخت APK دیده‌بان: فایل‌های وب ریشه‌ی ریپو را در پوسته‌ی Capacitor بسته‌بندی می‌کند
set -euo pipefail
cd "$(dirname "$0")"
ROOT=..

rm -rf www android node_modules assets
mkdir -p www assets
for f in index.html manifest.json icon.svg pupil.js pupil-core.js anomaly.js anomaly-core.js vision.js vision-core.js mosquito.js mosquito-core.js; do
  cp "$ROOT/$f" www/
done
if [ -d "$ROOT/mp" ]; then cp -r "$ROOT/mp" www/mp; else echo "WARNING: پوشه‌ی mp (مدل چهره) پیدا نشد؛ اسکن مردمک کار نمی‌کند"; fi

python3 - <<'PY'
import re
# service worker داخل اپ بومی لازم نیست و کش قدیمی بعد از به‌روزرسانی ایجاد می‌کند
p='www/index.html'; s=open(p,encoding='utf-8').read()
s2=re.sub(r"if\('serviceWorker' in navigator\)navigator\.serviceWorker\.register\('sw\.js'\)\.catch\(\(\)=>\{\}\);\n?","",s)
assert s2!=s, 'service worker line not found'
open(p,'w',encoding='utf-8').write(s2)
# سرور محلی اندروید برای .mjs نوع MIME درست نمی‌دهد؛ با پسوند .js بارگذاری می‌شود
p='www/pupil.js'; s=open(p,encoding='utf-8').read()
open(p,'w',encoding='utf-8').write(s.replace('./mp/vision_bundle.mjs','./mp/vision_bundle.js'))
PY
if [ -f www/mp/vision_bundle.mjs ]; then mv www/mp/vision_bundle.mjs www/mp/vision_bundle.js; fi

npm install --no-audit --no-fund
npx cap add android

# مجوزها
python3 - <<'PY'
p='android/app/src/main/AndroidManifest.xml'; s=open(p,encoding='utf-8').read()
add='''
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    <uses-feature android:name="android.hardware.sensor.compass" android:required="false" />
'''
assert '</manifest>' in s
open(p,'w',encoding='utf-8').write(s.replace('</manifest>',add+'</manifest>'))
PY

# افزونه‌ی مغناطیس‌سنج و فعالیت اصلی
JAVA=android/app/src/main/java/app/didehban
mkdir -p "$JAVA"
cp templates/*.java "$JAVA/"

# آیکون (در صورت خطا همان آیکون پیش‌فرض می‌ماند)
if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 1024 -h 1024 "$ROOT/icon.svg" -o assets/icon-only.png || true
  npm install --no-save --no-audit --no-fund @capacitor/assets >/dev/null 2>&1 || true
  npx capacitor-assets generate --android --iconBackgroundColor '#170f0e' --iconBackgroundColorDark '#170f0e' || echo "icon step skipped"
fi

npx cap sync android
cd android
chmod +x gradlew
for i in 1 2 3; do ./gradlew --version >/dev/null 2>&1 && break || { echo "gradle wrapper download retry $i"; sleep 10; }; done
./gradlew assembleDebug --no-daemon
ls -lh app/build/outputs/apk/debug/
