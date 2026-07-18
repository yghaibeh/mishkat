// مولّدُ بذرةِ الإعلام التجريبيّة **فوق بياناتٍ قائمة** (لا يُنشئ شبكةً جديدة):
// يربط التغطيات والصور بوحداتٍ وسجلّاتٍ ودروسٍ **موجودةٍ فعلاً** عبر SELECT، بمعرّفاتٍ ثابتةٍ
// (seed-cov-*/seed-att-*) فيكون إعادةُ التشغيل آمنةً (INSERT OR IGNORE)، والتراجعُ سطراً واحداً.
// الترتيب: scripts/seed_media_r2.sh أوّلاً (الملفّات) ثمّ هذه البذرة (الصفوف).
// الاستعمال: node scripts/gen_media_demo.mjs > src/server/database/seed_media_demo.sql
const NOW = Date.now();
const DAY = 86400000;
const PW = "pbkdf2$100000$8T/B/AaCUb7IZ0bystvNjw==$LxZKTHYFK9tz1EnXiZLfi4Je5xflHrh4ndYv1TrR+qA="; // = mishkat123
const q = (s) => s === null || s === undefined ? "NULL" : typeof s === "number" ? s : `'${String(s).replace(/'/g, "''")}'`;
const IMG = (i) => `seed-media/${String((i % 12) + 1).padStart(2, "0")}.jpg`;
const out = [];

// ===== مسؤول الإعلام التجريبيّ: للشبكة دورٌ بلا شاغلٍ فلا ناشرَ للتغطيات =====
out.push(`-- مسؤول الإعلام (تجريبيّ): الدخول media / mishkat123`);
out.push(`INSERT OR IGNORE INTO persons (id,full_name,gender,status,created_at) VALUES ('seed-p-media','مسؤول الإعلام','male','active',${NOW});`);
out.push(`INSERT OR IGNORE INTO users (id,person_id,login,password_hash,mfa_enabled,created_at) VALUES ('seed-u-media','seed-p-media','media',${q(PW)},0,${NOW});`);
out.push(`INSERT OR IGNORE INTO role_assignments (id,person_id,role,org_unit_id,org_path,start_date,term_number,approval_status,approved_by,created_at)
  SELECT 'seed-ra-media','seed-p-media','media',id,path,${NOW - 120 * DAY},1,'approved','u-admin',${NOW} FROM org_units WHERE section='men' AND type='section' LIMIT 1;`);
// احتياطٌ: إن لم تكن الجذرُ من نوع section فخذ أعلى وحدةٍ رجاليّة
out.push(`INSERT OR IGNORE INTO role_assignments (id,person_id,role,org_unit_id,org_path,start_date,term_number,approval_status,approved_by,created_at)
  SELECT 'seed-ra-media','seed-p-media','media',id,path,${NOW - 120 * DAY},1,'approved','u-admin',${NOW} FROM org_units WHERE section='men' ORDER BY length(path) LIMIT 1;`);
// عُهدتُه الشخصيّة (تبويب «عُهدتي»)
out.push(`INSERT OR IGNORE INTO assets (id,kind,name,details,org_unit_id,org_path,holder_person_id,holder_name,status,created_by,created_at,updated_at)
  SELECT 'seed-as-cam','equipment','كاميرا التغطيات','Canon — مع حقيبة وحامل',id,path,'seed-p-media','مسؤول الإعلام','active','u-admin',${NOW - 100 * DAY},${NOW - 100 * DAY} FROM org_units WHERE section='men' ORDER BY length(path) LIMIT 1;`);

// ===== ستُّ تغطياتٍ على مساجدَ حقيقيّةٍ مختلفة، لكلٍّ حدثُها ونوعُها وتاريخُها وألبومُها =====
const COVERAGES = [
  { kind: "opening", title: "افتتاحُ مصلّى الحيّ الجديد", body: "افتُتح المصلّى بحضور أهالي الحيّ ومسؤول المنطقة، وأُقيمت فيه أوّلُ صلاة جماعةٍ وحلقةُ تعريفٍ بالمنهاج.", photos: 3, ago: 6 },
  { kind: "distribution", title: "توزيعُ السلال الغذائيّة على الأسر المتعفّفة", body: "وزّعت لجنةُ الإغاثة ١٢٠ سلّةً غذائيّةً على أسر الحيّ، بإشراف أمير المسجد ومتابعة اللجنة.", photos: 3, ago: 12 },
  { kind: "ceremony", title: "تكريمُ حفّاظ الجزء الثلاثين", body: "كُرّم ثمانيةَ عشرَ طالباً أتمّوا حفظَ الجزء الثلاثين، بحضور ذويهم ومعلّميهم.", photos: 2, ago: 19 },
  { kind: "visit", title: "زيارةُ مسؤول المنطقة لحلقات المسجد", body: "جولةٌ ميدانيّةٌ على ثلاث حلقاتٍ ولقاءٌ مع المعلّمين حول متابعة المنهاج.", photos: 2, ago: 27 },
  { kind: "lesson", title: "درسُ «على بصيرة» — مجلسُ العقيدة", body: "المجلسُ الأوّل من مجالس العقيدة، بحضور أربعين طالباً.", photos: 2, ago: 34 },
  { kind: "event", title: "ملتقى أمراء المساجد الفصليّ", body: "ملتقًى فصليٌّ جمع أمراءَ المساجد لعرض خطّة الفصل ومناقشة معوّقات الميدان.", photos: 3, ago: 45 },
];
let img = 0;
COVERAGES.forEach((c, i) => {
  const at = NOW - c.ago * DAY;
  const id = `seed-cov-${i + 1}`;
  // مسجدٌ حقيقيٌّ مختلفٌ لكلّ تغطية (ترتيبٌ ثابتٌ بالمعرّف + إزاحة)
  out.push(`INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT ${q(id)},${q(c.title)},${q(c.kind)},id,path,${at},${q(c.body)},'seed-u-media',${at}
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET ${i * 5};`);
  for (let p = 0; p < c.photos; p++) {
    out.push(`INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-${i + 1}-${p + 1}','media_post',${q(id)},${q(IMG(img++))},'image/jpeg','seed-u-media',${at + p});`);
  }
});

// ===== ثمانِ صورِ توثيقٍ لسجلّات اليوم — منسوبةً لأمير مسجدها حين يكون له حساب =====
const DAILY_CAPS = ["توزيعُ سلالٍ على الأسر", "درسُ الفجر الأسبوعيّ", "حملةُ نظافة المسجد", "لقاءُ أسرة المسجد",
  "زيارةُ مريضٍ من أهل الحيّ", "إفطارُ صائمٍ في المسجد", "درسُ النساء الأسبوعيّ", "ترتيبُ مكتبة المسجد"];
DAILY_CAPS.forEach((cap, i) => {
  out.push(`INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d${i + 1}','daily_record',w.id,${q(IMG(img++))},${q(cap)},'image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    ${NOW - (i + 2) * DAY}
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET ${i};`);
});

// ===== ستُّ صورِ دروسٍ — نسبتُها لمعلّمها تُحلّ من الجلسة نفسها =====
for (let i = 0; i < 6; i++) {
  out.push(`INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l${i + 1}',s.id,${q(IMG(img++))},coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',${NOW - (i + 3) * DAY}
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET ${i * 3};`);
}

process.stdout.write("-- بذرةُ الإعلام التجريبيّة (مولّدة عبر scripts/gen_media_demo.mjs) — تُطبَّق فوق بياناتٍ قائمة\n" + out.join("\n") + "\n");
