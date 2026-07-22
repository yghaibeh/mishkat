/**
 * **الاختبارُ الإلزاميّ الثاني** (T19) — قب-٢٢: **منهاجٌ ثانٍ يُضاف بياناً فيعمل فوراً بلا كود**.
 *
 * وهو نظيرُ «نوعٌ خامس يُضاف صفّاً» في T16 و«نشاطٌ يُضاف بياناً» في T10 — والدرسُ الذي يحرسه:
 * كتالوجٌ **مسرودٌ في الكود** يُلزم مبرمجاً لكلّ توسّعٍ ميدانيّ (ع-٨: «قسمُ الرشيدي غير مفعّل»).
 *
 * ويحرس معه **دعوى بنيوية** تُقاس بالمحتوى لا بالبذرة (درسُ قب-٤٠): صفوفُ المنهاج **بلا مفتاح
 * تفعيلٍ إطلاقاً** — فلا بابَ ثانياً للمنع فوق الصلاحية.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  allCurricula,
  curriculumForCircleType,
  curriculumOfSession,
  manhajTree,
  sessionById,
  sessionsOfCurriculum,
  upsertBook,
  upsertCurriculum,
  upsertLevel,
  upsertSession,
} from "../../../src/features/education/services/curriculum.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import {
  CURRICULUM_ID,
  educationContext,
  HELD_AT,
  SESSION_A,
  SESSION_B,
  seedWorld,
  BOOK_ID,} from "./_seed.js"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/education", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

describe("قب-٢٢/١ — المنهاجُ **بياناتٌ مرجعية**: يُقرأ صفوفاً ويُرتَّب حتمياً", () => {
  it("منهاجُ نوعِ الحلقة يُعثر عليه **بنوعها لا باسمٍ مُصلَّب**", () => {
    const w = seedWorld()
    const found = curriculumForCircleType(w.education, "baseera")
    expect(found?.id).toBe(CURRICULUM_ID)
    expect(curriculumForCircleType(w.education, "tahfeez")).toBeNull()
  })

  it("ومجالسُ المنهاج مرتّبةٌ بالمستوى فالكتاب فالمجلس — ترتيبٌ حتميّ لا ترتيبَ إدخال", () => {
    const w = seedWorld()
    const sessions = sessionsOfCurriculum(w.education, CURRICULUM_ID)
    expect(sessions.map((s) => s.id)).toEqual([SESSION_A, SESSION_B])
    expect(curriculumOfSession(w.education, SESSION_A)?.id).toBe(CURRICULUM_ID)
    expect(sessionById(w.education, "لا-وجود-له")).toBeNull()
  })

  it("وشجرةُ المنهاج تُبنى من الصفوف كلِّها بلا مرشّحِ حالة", () => {
    const w = seedWorld()
    const tree = manhajTree(w.education)
    expect(tree).toHaveLength(1)
    expect(tree[0]?.levels[0]?.books[0]?.sessions).toHaveLength(2)
    expect(allCurricula(w.education)).toHaveLength(1)
  })
})

describe("**قب-٢٢/٢ — منهاجٌ ثانٍ بياناً: مرفوضٌ ⟵ يُضاف صفوفاً ⟵ مقبولٌ فوراً بلا سطر كود**", () => {
  it("درسٌ على حلقةٍ نوعُها بلا منهاج ⇒ `NO_CURRICULUM_FOR_TYPE`، ثم يعمل فور إضافة الصفوف", () => {
    const w = seedWorld()
    const ctx = educationContext(w)

    // ① حلقةٌ نوعُها `tahfeez` — لا منهاجَ لها اليوم ⇒ **رفضٌ مُشخِّص**.
    const before = recordLesson(w.education, ctx, {
      circleId: w.tahfeezCircleId,
      sessionId: "ses-t1",
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [],
    })
    expect(before.ok).toBe(false)
    expect(before.ok === false && before.error.code).toBe("NO_CURRICULUM_FOR_TYPE")

    // ② يُضاف المنهاجُ الثاني **صفوفاً** — بلا سطرِ كودٍ واحد.
    expect(
      upsertCurriculum(w.education, ctx, { id: "cur-tahfeez", ar: "منهاجُ التحفيظ", circleTypeId: "tahfeez" }).ok,
    ).toBe(true)
    expect(upsertLevel(w.education, ctx, { id: "lvl-t", curriculumId: "cur-tahfeez", ar: "المستوى", ordinal: 1 }).ok).toBe(true)
    expect(upsertBook(w.education, ctx, { id: "book-t", levelId: "lvl-t", ar: "جزءُ عمّ", ordinal: 1 }).ok).toBe(true)
    expect(upsertSession(w.education, ctx, { id: "ses-t1", bookId: "book-t", ar: "المجلسُ الأول", ordinal: 1 }).ok).toBe(true)

    // ③ نفسُ الطلب — **مقبولٌ فوراً**.
    const enrolled = w.circles.enrollments().filter((e) => e.circleId === w.tahfeezCircleId)
    const after = recordLesson(w.education, ctx, {
      circleId: w.tahfeezCircleId,
      sessionId: "ses-t1",
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: enrolled.map((e) => e.id),
    })
    expect(after.ok, after.ok === false ? after.error.code : "").toBe(true)
    expect(curriculumForCircleType(w.education, "tahfeez")?.id).toBe("cur-tahfeez")
  })

  it("**والمنهاجُ الثاني يظهر في الشجرة فوراً** — ولا نوعَ يختفي لأنه أُضيف متأخراً", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    upsertCurriculum(w.education, ctx, { id: "cur-sci", ar: "منهاجُ العلمية", circleTypeId: "scientific" })
    expect(manhajTree(w.education).map((c) => c.id).sort()).toEqual(["cur-baseera", "cur-sci"])
  })

  it("ونوعُ حلقةٍ مجهولٌ في الكتالوج ⇒ `UNKNOWN_CIRCLE_TYPE` — القائمةُ مغلقةٌ (ق-٨٩)", () => {
    const w = seedWorld()
    const done = upsertCurriculum(w.education, educationContext(w), {
      id: "cur-x",
      ar: "منهاجٌ لنوعٍ مخترع",
      circleTypeId: "لا-وجود-له",
    })
    expect(done.ok).toBe(false)
    expect(done.ok === false && done.error.code).toBe("UNKNOWN_CIRCLE_TYPE")
  })

  it("والصفوفُ المعلَّقة تُردّ بسببها المميِّز: مستوىً لمنهاجٍ مجهول · كتابٌ لمستوىً مجهول · مجلسٌ لكتابٍ مجهول", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    expect(upsertLevel(w.education, ctx, { id: "x", curriculumId: "لا", ar: "م", ordinal: 1 }).ok).toBe(false)
    expect(upsertBook(w.education, ctx, { id: "x", levelId: "لا", ar: "ك", ordinal: 1 }).ok).toBe(false)
    expect(upsertSession(w.education, ctx, { id: "x", bookId: "لا", ar: "ج", ordinal: 1 }).ok).toBe(false)
    expect(upsertCurriculum(w.education, ctx, { id: "x", ar: "  ", circleTypeId: "baseera" }).ok).toBe(false)
  })
})

/**
 * **دعوى بنيوية تُقاس بالمحتوى** (درسُ قب-٤٠): «لا مفتاحَ تفعيلٍ للمنهاج» لا يُحرَس بالسلوك —
 * لأنّ البذرةَ لا تكتب الحقلَ أصلاً فيمرّ الحارسُ على بذرته ويفوته الواقع.
 */
describe("ع-٨ — **مفتاحُ تفعيلِ المنهاج مستحيلٌ بنيوياً**، ولا اسمَ منهاجٍ في الكود", () => {
  function typeBody(name: string): string {
    const source = code(join(UNIT_DIR, "types.ts"))
    const at = source.indexOf(`export type ${name} = {`)
    expect(at, `تعريفُ \`${name}\` غير موجود في \`types.ts\``).toBeGreaterThan(-1)
    return source.slice(at, source.indexOf("}", at))
  }

  it("صفوفُ المنهاج الأربعة بحقولها المعلنة — ولا حقلَ حالةٍ في أيٍّ منها", () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      Curriculum: ["ar", "circleTypeId", "id", "tenantId"],
      CurriculumLevel: ["ar", "curriculumId", "id", "ordinal", "tenantId"],
      CurriculumBook: ["ar", "id", "levelId", "ordinal", "tenantId"],
      CurriculumSession: ["ar", "bookId", "id", "ordinal", "tenantId"],
    }
    for (const [name, fields] of Object.entries(expected)) {
      const actual = [...typeBody(name).matchAll(/readonly\s+(\w+)\s*[?:]/g)].map((m) => m[1])
      expect(actual.sort(), name).toEqual([...fields])
      for (const f of actual) {
        expect(/active|enabled|state|status|visible|published/i.test(f ?? ""), `${name}.${f}`).toBe(false)
      }
    }
  })

  it("**ولا سطرَ يقرأ حالةَ صفٍّ مرجعيّ** — فلا سؤالَ «أمفعَّل؟» يُطرح أصلاً في الوحدة كلِّها", () => {
    // **يُقاس على أيّ قارئٍ مهما كان اسمُ متغيّره**: حارسٌ يشترط اسماً بعينه (`curriculum.active`)
    // يفوته `c.active` — وهو بعينه عطبُ «الحارس الذي يمرّ على بذرته» (قب-٤٠).
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/\.(?:active|enabled|isActive|visible|published)\b/.test(line)) {
            offenders.push(`${file}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `سؤالُ «أمفعَّل؟» عن صفٍّ مرجعيّ: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا اسمَ منهاجٍ ولا نوعِ حلقةٍ مُصلَّبٌ في كود الوحدة** — الأسماءُ قيمُ صفوفٍ لا ثوابتُ كود", () => {
    const legacy = ["baseera", "tahfeez", "alabaseera", "rashidi", "halaqa"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of legacy) {
        if (lowered.includes(token)) offenders.push(`${file} ⟵ ${token}`)
      }
    }
    expect(offenders, `اسمٌ مُصلَّبٌ بدل الكتالوج: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**وكتالوجُ المنهاج لا يُرشَّح بحالة**: `allCurricula` تعيد كلَّ صفٍّ في المستودع", () => {
    const catalog = code(join(UNIT_DIR, "services/curriculum.ts"))
    expect(/\.filter\s*\(\s*\(?\w+\)?\s*=>\s*\w+\.(?:active|enabled)/.test(catalog)).toBe(false)
  })

  /**
   * **صفٌّ يتيمٌ لا يُسقط الشجرةَ ولا يُخضِرّ الغموض** — بياناتٌ مرجعيةٌ يكتبها إنسانٌ تحتمل
   * الحلقةَ المقطوعة (مجلسٌ بلا كتاب، أو كتابٌ بلا مستوى): فالجوابُ **«لا منهاج»** صريحاً،
   * لا تخمينٌ لأقرب منهاج. (نظيرُ قاعدة CR-011 على مستهلِك بيانات.)
   */
  it("**والحلقةُ المقطوعة تُجيب «لا منهاج»**: مجلسٌ بلا كتابٍ أو كتابٌ بلا مستوىً أو مستوىً بلا منهاج", () => {
    const w = seedWorld()
    const tenantId = w.education.tenantId

    w.education.saveSession({ tenantId, id: "orphan-session", bookId: "no-such-book", ar: "مجلسٌ يتيم", ordinal: 1 })
    expect(curriculumOfSession(w.education, "orphan-session")).toBe(null)

    w.education.saveBook({ tenantId, id: "orphan-book", levelId: "no-such-level", ar: "كتابٌ يتيم", ordinal: 1 })
    w.education.saveSession({ tenantId, id: "session-of-orphan-book", bookId: "orphan-book", ar: "مجلس", ordinal: 1 })
    expect(curriculumOfSession(w.education, "session-of-orphan-book")).toBe(null)

    w.education.saveLevel({ tenantId, id: "orphan-level", curriculumId: "no-such-curriculum", ar: "مستوىً يتيم", ordinal: 1 })
    w.education.saveBook({ tenantId, id: "book-of-orphan-level", levelId: "orphan-level", ar: "كتاب", ordinal: 1 })
    w.education.saveSession({ tenantId, id: "session-of-orphan-level", bookId: "book-of-orphan-level", ar: "مجلس", ordinal: 1 })
    expect(curriculumOfSession(w.education, "session-of-orphan-level")).toBe(null)

    // ومجلسٌ لا وجودَ له أصلاً ⇒ `null` كذلك — **لا رميَ ولا تخمين**.
    expect(curriculumOfSession(w.education, "no-such-session")).toBe(null)
  })

  it("**والترتيبُ حتميٌّ عند تساوي الرتب**: المعرّفُ يفصل — فلا يتقلّب العرضُ بين تشغيلين", () => {
    const w = seedWorld()
    const tenantId = w.education.tenantId
    // **رتبةٌ واحدةٌ لمجلسين** — بياناتٌ يكتبها إنسان، فالتساوي وارد.
    w.education.saveSession({ tenantId, id: "ses-tie-b", bookId: BOOK_ID, ar: "مجلسٌ ب", ordinal: 5 })
    w.education.saveSession({ tenantId, id: "ses-tie-a", bookId: BOOK_ID, ar: "مجلسٌ أ", ordinal: 5 })

    const ordered = sessionsOfCurriculum(w.education, CURRICULUM_ID).map((s) => s.id)
    expect(ordered.slice(-2)).toEqual(["ses-tie-a", "ses-tie-b"])
    // والتشغيلُ الثاني يُعطي الترتيبَ نفسَه.
    expect(sessionsOfCurriculum(w.education, CURRICULUM_ID).map((s) => s.id)).toEqual(ordered)
  })
})
