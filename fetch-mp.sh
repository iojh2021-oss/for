#!/bin/sh
# دانلود مدل چهره و فایل‌های MediaPipe کنار اپ (یک بار، با اینترنت)
set -e
cd "$(dirname "$0")"
mkdir -p mp/wasm
V=$(curl -fsSL "https://data.jsdelivr.com/v1/packages/npm/@mediapipe/tasks-vision/resolved?specifier=latest" | grep -oE '"version": ?"[^"]+"' | head -1 | cut -d'"' -f4)
[ -n "$V" ] || { echo "نسخه پیدا نشد"; exit 1; }
echo "نسخه: $V"
curl -fsSL "https://data.jsdelivr.com/v1/packages/npm/@mediapipe/tasks-vision@$V?structure=flat" \
 | grep -oE '"name": ?"/(wasm/[^"]+|vision_bundle\.mjs)"' | cut -d'"' -f4 | while read -r f; do
  echo "دانلود $f"
  curl -fsSL "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$V$f" -o "mp$f"
done
echo "دانلود مدل چهره"
curl -fsSL "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" -o mp/face_landmarker.task
ls -lh mp mp/wasm
echo "تمام. حالا: git add -A && git commit -m 'add mediapipe' && git push"
