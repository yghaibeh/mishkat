#!/usr/bin/env bash
# نشرٌ غيرُ تفاعليّ (لا يحتاج wrangler login) — يُصادِق بتوكن API مخزَّنٍ محلّيًّا (كما في CI).
# الاستعمال:  ./scripts/deploy.sh
# يقرأ التوكن من app/.cloudflare.env (مُتجاهَلٌ في git):  CLOUDFLARE_API_TOKEN=...
set -euo pipefail
cd "$(dirname "$0")/.."

# ١) حمِّل التوكن إن وُجد (بلا طباعته)
if [ -f .cloudflare.env ]; then
  set -a; . ./.cloudflare.env; set +a
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "✗ لا CLOUDFLARE_API_TOKEN. أنشئ توكنًا (Workers Scripts:Edit + D1:Edit + Account:Read) وضعه في app/.cloudflare.env:"
  echo "    CLOUDFLARE_API_TOKEN=xxxxxxxx"
  echo "  ثم أعد التشغيل. (الملفُّ مُتجاهَلٌ في git — لا يُرفع.)"
  exit 1
fi

echo "→ تطبيق الهجرات على remote…"
npx wrangler d1 migrations apply influential-masjid --remote

echo "→ النشر…"
npx wrangler deploy

echo "→ فحصُ الصحّة…"
code=$(curl -s -o /dev/null -w '%{http_code}' https://mishkat.yghaibeh.workers.dev/login || echo "000")
echo "  /login → $code"
[ "$code" = "200" ] && echo "✓ تمّ النشر بنجاح." || { echo "✗ فحصُ الصحّة فشل"; exit 1; }
