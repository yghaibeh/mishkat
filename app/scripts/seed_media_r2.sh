#!/usr/bin/env bash
# رفعُ صور البذرة إلى R2 بمفاتيحَ ثابتة (seed-media/NN.jpg) — تقابلها صفوفُ المرفقات في البذرة.
# الترتيب إلزاميّ: هذا أوّلاً ثمّ بذرةُ SQL — فصفُّ مرفقٍ بلا ملفٍّ يعطي مربعاً مكسوراً
# (الدرسُ المستفاد ٢٠٢٦-٠٧-١٨: صفوفٌ بلا r2_key كانت تسقط صامتةً على NOT NULL).
# الاستعمال:  bash scripts/seed_media_r2.sh [--local]
set -euo pipefail
cd "$(dirname "$0")/.."
BUCKET="mishkat-media"
FLAG="--remote"
[ "${1:-}" = "--local" ] && FLAG="--local"
for f in scripts/seed-media/*.jpg; do
  key="seed-media/$(basename "$f")"
  echo "→ $key"
  npx wrangler r2 object put "$BUCKET/$key" --file "$f" --content-type image/jpeg $FLAG >/dev/null
done
echo "✓ رُفعت $(ls scripts/seed-media/*.jpg | wc -l | tr -d ' ') صورة إلى $BUCKET"
