/**
 * **الاختباراتُ الإلزاميّة الثمانية لمهمة T22** — تنفيذُ CR-016: *الجلسةُ اليومية **كيانٌ
 * واحد** وشكلُ حقولها يتبع **نوعَ الحلقة***.
 *
 * وهذا الملفُّ **عابرٌ للوحدتين عمداً**: التعارضُ الذي كشفته G20 لم يكن داخلَ وحدةٍ بل **عند
 * التقائهما** (قب-٤٣) — فحارسُه يجب أن يقف حيث تلتقيان، لا في مساحة إحداهما.
 *
 *  ١. **كيانٌ واحد**: جلسةُ تحفيظٍ وجلسةُ منهاجٍ **صفّان من كيانٍ واحد** — بنيويّاً وسلوكياً.
 *  ٢. **صفر جسرِ مزامنة** — مسحٌ محتوائيّ (نظيرُ حارس T16: ق-٨٨ متقاعدٌ لا منقول).
 *  ٣. **`canonicalHome` لا يتكرر** — والحارسُ المركزيّ أخضرُ **بلا تعديله**.
 *  ٤. **الحقولُ بالنوع**: جلسةٌ بحقول نوعٍ آخر ⇒ **مرفوضة**.
 *  ٥. **صفر عدّادٍ مخزَّن** للتقدّم أو الحضور — اشتقاقٌ لحظةَ السؤال (ق-٩٢).
 *  ٦. **ق-٨٤**: المديرُ والمشرفُ **لا يُدخلان** — في **المسارين معاً**.
 *  ٧. **قواعدُ الوحدتين باقيةٌ عاملة** بعد التوحيد: ق-٩٠ · ق-٩١ · ق-٩٢ · ق-٨٥ · ق-٨٦.
 *  ٨. **عزلُ الشبكة والنطاق** ومصفوفةُ الشاشات: غيابٌ **مقرونٌ برفض الخادم**.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { CircleLogStore } from "../../../src/features/circleLog/data/store.js"
import { circleModelFrom } from "../../../src/features/circleLog/services/circlesPort.js"
import {
  recordCurriculumSession,
  recordSession,
} from "../../../src/features/circleLog/services/sessions.js"
import { circleRanking } from "../../../src/features/circleLog/services/ranking.js"
import { circleDayView, studentRecordView } from "../../../src/features/circleLog/services/derive.js"
import { makeCircleLogEndpoints } from "../../../src/features/circleLog/server/endpoints.js"
import { makeEducationEndpoints } from "../../../src/features/education/server/endpoints.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import { curriculumProgress } from "../../../src/features/education/services/progress.js"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
import { registeredScreens } from "../../../src/ui/screens/registry.js"
import "../../../src/screens.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  canonicalActor,
  circleDays,
  educationContext,
  educationPorts,
  HELD_AT,
  KHALID_PATH,
  logContextOf,
  NEXT_DAY,
  NOW,
  SECOND_TENANT_ID,
  SESSION_A,
  SETTINGS,
  seedWorld,
  WRITE,
  type EduWorld,
} from "../education/_seed.js"

// ── أدواتُ القياس المحتوائيّ (دعوى بنيوية تُقاس بالمحتوى — درسُ قب-٤٠) ──────────

const FEATURES_DIR = fileURLToPath(new URL("../../../src/features", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

function within(path: string): string {
  return relative(FEATURES_DIR, path).split(sep).join("/")
}

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

const UNIFIED = ["circleLog", "education"] as const
const unifiedFiles = (): string[] =>
  sourceFiles(FEATURES_DIR).filter((f) => UNIFIED.some((m) => within(f).startsWith(`${m}/`)))

/** مساحةُ قياس «كم كياناً؟» — الكياناتُ المخزَّنة تعيش في `types.ts` و`data/`. */
const storedFiles = (): string[] =>
  unifiedFiles().filter((f) => /(^|\/)types\.ts$/.test(within(f)) || /(^|\/)data\//.test(within(f)))

// ── عالمُ الشكلين: حلقةٌ نوعُها ذو منهاج، وحلقةٌ نوعُها بلا منهاج ────────────────

/** يسجّل جلسةَ **شكل التحفيظ** على الحلقة التي لا منهاجَ لنوعها. */
function recordRecitationDay(w: EduWorld, at: Date = HELD_AT) {
  const roster = w.circles.enrollments().filter((e) => e.circleId === w.tahfeezCircleId)
  return recordSession(w.log, logContextOf(w, { actorPersonId: "u-teacher" }), {
    circleId: w.tahfeezCircleId,
    at,
    rows: roster.map((e, i) => ({
      enrollmentId: e.id,
      attendance: "present" as const,
      memorizationGrade: i === 0 ? 8 : null,
    })),
  })
}

/** يسجّل جلسةَ **شكل المنهاج** على الحلقة التي لنوعها منهاجٌ مسجَّل — بقواعد وحدة التعليم. */
function recordCurriculumDay(w: EduWorld, at: Date = HELD_AT, minutes = 60) {
  return recordLesson(w.education, educationContext(w), {
    circleId: w.circleId,
    sessionId: SESSION_A,
    heldAt: at,
    durationMinutes: minutes,
    presentEnrollmentIds: [w.enrollmentIds[0]!, w.enrollmentIds[1]!],
  })
}

beforeEach(() => {
  clearRegistryForTests()
})

// ── ١ ───────────────────────────────────────────────────────────────────────

describe("T22/١ — **كيانٌ واحد**: جلسةُ التحفيظ وجلسةُ المنهاج صفّان من كيانٍ واحد", () => {
  it("**سلوكياً**: الشكلان يُكتبان في **مستودعٍ واحدٍ بمفتاحٍ طبيعيٍّ واحد**، ويُقرآن معاً", () => {
    const w = seedWorld()
    const recitation = recordRecitationDay(w)
    const curriculum = recordCurriculumDay(w)
    expect(recitation.ok, recitation.ok === false ? recitation.error.code : "").toBe(true)
    expect(curriculum.ok, curriculum.ok === false ? curriculum.error.code : "").toBe(true)
    if (!recitation.ok || !curriculum.ok) return

    // **صفّان من كيانٍ واحد**: مستودعٌ واحد، ونوعٌ واحد، ومفتاحٌ طبيعيٌّ واحد (حلقة × يوم).
    const rows = w.log.sessions()
    expect(rows).toHaveLength(2)
    expect([...rows].map((s) => s.shape.kind).sort()).toEqual(["curriculum", "recitation"])
    for (const row of rows) {
      expect(row.dayKey).toBe(rows[0]!.dayKey)
      expect(w.log.getSession(row.circleId, row.dayKey, row.periodId)?.id).toBe(row.id)
    }
    // والمعرّفان من **عدّاد المستودع نفسِه** — لا فضاءَي معرّفاتٍ منفصلين.
    expect(new Set(rows.map((s) => s.id)).size).toBe(2)
  })

  it("**وبنيوياً**: كيانُ الجلسة **مُعلَنٌ مرّةً واحدة**، ولا مستودعَ جلساتٍ ثانٍ", () => {
    const declarers = storedFiles()
      .filter((f) => /\btype\s+DaySession\s*=\s*\{/.test(code(f)))
      .map(within)
    expect(declarers, `كيانُ جلسةٍ ثانٍ في: ${declarers.join(" · ")}`).toEqual([
      "circleLog/types.ts",
    ])

    // **صفر مقبضِ كتابةٍ للجلسة خارج موطنها** — ولو في وحدة التعليم عبر مستودعها.
    const writers = unifiedFiles()
      .filter((f) => /\.upsertSession\s*\(/.test(code(f)))
      .map(within)
    expect(writers).toEqual(["circleLog/services/sessions.ts"])
  })

  it("**والوصلُ ملفٌّ واحدٌ لا أكثر ولا صفر** (نظيرُ `circleLog ← circles` القائم)", () => {
    const importers = unifiedFiles()
      .filter((f) => within(f).startsWith("education/"))
      .filter((f) => /from\s+"[^"]*\.\.\/circleLog\//.test(code(f)))
      .map(within)
    // **صفرٌ** ⇒ أُعيد بناءُ الكيان هنا · **اثنان** ⇒ تسرّبت معرفتُه إلى الخدمات.
    expect(importers).toEqual(["education/services/dayLogPort.ts"])
  })

  it("**ولا تعرف وحدةُ الكيان صاحبَ القواعد**: صفر استيرادٍ من `education` في `circleLog`", () => {
    const offenders = unifiedFiles()
      .filter((f) => within(f).startsWith("circleLog/"))
      .filter((f) => /from\s+"[^"]*\.\.\/education\//.test(code(f)))
      .map(within)
    expect(offenders, `اعتمادٌ معكوسٌ يُغلق حلقةَ استيراد: ${offenders.join(" · ")}`).toEqual([])
  })
})

// ── ٢ ───────────────────────────────────────────────────────────────────────

describe("T22/٢ — **صفر جسرِ مزامنة** (ق-٨٨ متقاعدٌ لا منقول)", () => {
  it("لا مقبضَ جسرٍ ولا مزامنةٍ ولا توأمةٍ ولا مرآةٍ في الوحدتين معاً", () => {
    const forbidden = ["bridge", "sync", "twin", "mirror", "propagate"]
    const offenders: string[] = []
    for (const file of unifiedFiles()) {
      const lowered = code(file).toLowerCase()
      for (const token of forbidden) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) {
          offenders.push(`${within(file)} ⟵ ${token}`)
        }
      }
    }
    expect(offenders, `مقبضُ جسرٍ بين الوحدتين: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**والغيابُ يُقاس على النسخة لا على الاسم**: لا كيانَ درسٍ مخزَّنٌ في وحدة التعليم", () => {
    const RIVAL = /\b(?:type|interface)\s+\w*(?:Lesson|DaySession|Attendance)\w*\s*=?\s*\{/
    const declarers = storedFiles()
      .filter((f) => within(f).startsWith("education/"))
      .filter((f) => RIVAL.test(code(f)))
      .map(within)
    expect(declarers, `كيانُ درسٍ ثانٍ: ${declarers.join(" · ")}`).toEqual([])
  })
})

// ── ٣ ───────────────────────────────────────────────────────────────────────

describe("T22/٣ — **`canonicalHome` لا يتكرر**، والموطنُ الواحد للجلسة معلن", () => {
  it("لا كيانٌ يُعلَن موطنُه في شاشتين — والحارسُ المركزيُّ أخضرُ بلا تعديله", () => {
    const home = new Map<string, string>()
    const clashes: string[] = []
    for (const s of registeredScreens()) {
      for (const entity of s.contract.canonicalHome) {
        const prior = home.get(entity)
        if (prior !== undefined) clashes.push(`«${entity}» موطنُه ${prior} و${s.contract.route}`)
        else home.set(entity, s.contract.route)
      }
    }
    expect(clashes, clashes.join(" · ")).toEqual([])
    // **وموطنُ «الدرس/الجلسة اليومية» هو «سجل اليوم»** (IA ك-٣ نصاً).
    expect(home.get("lesson")).toBe("/mosque/circles/log")
    expect(home.get("curriculumProgress")).toBe("/mosque/circles/lessons")
  })
})

// ── ٤ ───────────────────────────────────────────────────────────────────────

describe("T22/٤ — **الحقولُ تتبع النوع**: جلسةٌ بحقول نوعٍ آخر ⇒ مرفوضة", () => {
  it("شكلُ التحفيظ على حلقةٍ نوعُها ذو منهاج ⇒ `SESSION_SHAPE_MISMATCH`", () => {
    const w = seedWorld()
    const done = recordSession(w.log, logContextOf(w), {
      circleId: w.circleId,
      at: HELD_AT,
      rows: [{ enrollmentId: w.enrollmentIds[0]!, attendance: "present", memorizationGrade: 9 }],
    })
    expect(done.ok === false && done.error.code).toBe("SESSION_SHAPE_MISMATCH")
  })

  it("**وشكلُ المنهاج على حلقةٍ نوعُها بلا منهاج ⇒ مرفوض كذلك** — والرفضُ في الطرفين", () => {
    const w = seedWorld()
    const roster = w.circles.enrollments().filter((e) => e.circleId === w.tahfeezCircleId)
    const direct = recordCurriculumSession(w.log, logContextOf(w), {
      circleId: w.tahfeezCircleId,
      at: HELD_AT,
      companion: {
        curriculumSessionId: SESSION_A,
        durationMinutes: 60,
        presentEnrollmentIds: [roster[0]!.id],
      },
    })
    expect(direct.ok === false && direct.error.code).toBe("SESSION_SHAPE_MISMATCH")

    // ومن باب وحدة التعليم: تشخيصٌ أدقُّ يسبق الأعمّ — «لا منهاجَ لهذا النوع».
    const viaRules = recordLesson(w.education, educationContext(w), {
      circleId: w.tahfeezCircleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [roster[0]!.id],
    })
    expect(viaRules.ok === false && viaRules.error.code).toBe("NO_CURRICULUM_FOR_TYPE")
  })

  it("**والمنعُ بالنوع قبل الحارس**: المخزَّنُ لا يحمل حقولَ الشكل الآخر أصلاً", () => {
    const w = seedWorld()
    expect(recordRecitationDay(w).ok).toBe(true)
    expect(recordCurriculumDay(w).ok).toBe(true)

    for (const session of w.log.sessions()) {
      if (session.shape.kind === "curriculum") {
        // **غيابُ الحقل لا فراغُه**: لا تقييمَ حفظٍ في سطرٍ من جلسةِ منهاج.
        expect(session.rows.every((r) => r.evaluation === null)).toBe(true)
        expect(session.shape.companion.curriculumSessionId).toBe(SESSION_A)
      } else {
        // ولا منهجَ مصاحبٌ في جلسة تحفيظ — **بالنوع**: الفرعُ لا يحمل الحقلَ إطلاقاً.
        expect(Object.hasOwn(session.shape, "companion")).toBe(false)
        expect(session.rows.some((r) => r.evaluation !== null)).toBe(true)
      }
    }
  })

  it("**والشكلُ يُشتقّ من صفوف البيانات لا من الكود**: منهاجٌ يُضاف ⇒ الشكلُ ينقلب بلا سطر", () => {
    const w = seedWorld()
    // اليومَ: نوعُ الحلقة الثانية بلا منهاج ⇒ شكلُها تحفيظ، وجلسةُ المنهاج مرفوضة.
    expect(recordRecitationDay(w).ok).toBe(true)

    // **ثم يُضاف منهاجٌ لنوعها صفّاً** — فينقلب شكلُها **فوراً** بلا نشرِ كود.
    const circle = circleModelFrom(w.circles).circleOf(w.tahfeezCircleId)!
    w.education.saveCurriculum({
      tenantId: w.education.tenantId,
      id: "cur-second",
      ar: "منهاجٌ ثانٍ",
      circleTypeId: circle.typeId,
    })
    const after = recordRecitationDay(w, NEXT_DAY)
    expect(after.ok === false && after.error.code).toBe("SESSION_SHAPE_MISMATCH")
  })
})

// ── ٥ ───────────────────────────────────────────────────────────────────────

describe("T22/٥ — **صفر عدّادٍ مخزَّن** للتقدّم أو الحضور", () => {
  it("`types.ts` و`data/` في الوحدتين بلا حقلٍ يحفظ عدداً أو نسبةً أو متوسّطاً", () => {
    expect(storedFiles().length).toBeGreaterThan(0)
    const COUNTER =
      /\b(?:count|total|tally|attendanceCount|presentCount|average|avg|pct|percent|rate|score|streak)\w*\s*:/i
    const offenders: string[] = []
    for (const file of storedFiles()) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/\b(?:ayahCount|pageCount)\s*:/.test(line)) return
          if (COUNTER.test(line)) offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
        })
    }
    expect(offenders, `عدّادٌ مخزَّن: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**والتقدّمُ يتغيّر بلا كتابةٍ ثانية**: الاعتمادُ وحدَه يحرّك الخليّة (ق-٩٢)", () => {
    const w = seedWorld()
    const done = recordCurriculumDay(w)
    expect(done.ok).toBe(true)
    if (!done.ok) return

    const before = curriculumProgress(w.education, educationContext(w), w.circleId)
    expect(before.ok && before.value.completedCells).toBe(0)

    // **لا سطرَ يُكتب عند الاعتماد** — المصفوفةُ تُبنى لحظةَ السؤال من الحال.
    const after = curriculumProgress(
      w.education,
      educationContext(w, { approvedLessonIds: [done.value.id] }),
      w.circleId,
    )
    expect(after.ok && after.value.completedCells).toBe(2)
    expect(w.education.corrections()).toHaveLength(0)
  })
})

// ── ٦ ───────────────────────────────────────────────────────────────────────

describe("T22/٦ — **ق-٨٤: المديرُ والمشرفُ لا يُدخلان** — في المسارين معاً", () => {
  const OUTSIDERS: readonly { readonly label: string; readonly actor: () => Actor }[] = [
    { label: "admin", actor: () => canonicalActor("u-admin") },
    { label: "section_head", actor: () => canonicalActor("u-section-head") },
    { label: "rabita", actor: () => canonicalActor("u-rabita") },
    { label: "square", actor: () => canonicalActor("u-square") },
  ]

  it("مسارُ **شكل التحفيظ**: `circle.log.record` مرفوضٌ للمدير والمشرفين الثلاثة", async () => {
    const w = seedWorld()
    const ep = makeCircleLogEndpoints({
      store: w.log,
      circles: circleModelFrom(w.circles),
      settings: createSettingsResolver([]),
      newToken: () => "tok",
    })
    const roster = w.circles.enrollments().filter((e) => e.circleId === w.tahfeezCircleId)
    for (const who of OUTSIDERS) {
      const r = await ep.record.invoke(
        {
          circleId: w.tahfeezCircleId,
          at: HELD_AT,
          rows: [{ enrollmentId: roster[0]!.id, attendance: "present" as const }],
        },
        who.actor(),
        WRITE,
      )
      expect(r.ok, `${who.label} أُدخل وهو لا يملك الإدخال`).toBe(false)
    }
  })

  it("مسارُ **شكل المنهاج**: بابا التسجيل مرفوضان لهم كذلك — **رفضٌ في الخادم لا إخفاءٌ**", async () => {
    const w = seedWorld()
    const ep = makeEducationEndpoints(
      w.education,
      educationPorts(w),
      SETTINGS,
      () => false,
      circleDays(w),
    )
    const input = {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    }
    for (const who of OUTSIDERS) {
      expect((await ep.record.invoke(input, who.actor(), WRITE)).ok).toBe(false)
      expect((await ep.recordByOwner.invoke(input, who.actor(), WRITE)).ok).toBe(false)
    }
    // ولا جلسةَ كُتبت في الطريق — **الرفضُ يُقفل ولا يُفتح**.
    expect(w.log.sessions()).toHaveLength(0)
  })
})

// ── ٧ ───────────────────────────────────────────────────────────────────────

describe("T22/٧ — **قواعدُ الوحدتين باقيةٌ عاملة بعد التوحيد** (لا انحدارَ في ميزة)", () => {
  it("**ق-٩٠**: جلسةٌ لكل (حلقة × يوم)، و`upsert` آمنُ الإعادة في **الشكلين معاً**", () => {
    const w = seedWorld()
    expect(recordRecitationDay(w).ok).toBe(true)
    expect(recordRecitationDay(w).ok).toBe(true)
    const first = recordCurriculumDay(w, HELD_AT, 60)
    const again = recordCurriculumDay(w, HELD_AT, 75)
    expect(first.ok && again.ok).toBe(true)
    if (!first.ok || !again.ok) return
    expect(again.value.id).toBe(first.value.id)
    expect(again.value.durationMinutes).toBe(75)
    expect(w.log.sessions()).toHaveLength(2)
  })

  it("**ق-٩١**: التقييمُ الدوريّ يبدأ من حلقات النطاق كلِّها، والشكلان يُسهمان بحضورهما", () => {
    const w = seedWorld()
    expect(recordRecitationDay(w).ok).toBe(true)
    expect(recordCurriculumDay(w).ok).toBe(true)

    const ranking = circleRanking(w.log, logContextOf(w), { unitPath: KHALID_PATH })
    const byCircle = new Map(ranking.rows.map((r) => [r.circleId, r]))
    expect(byCircle.get(w.tahfeezCircleId)?.inactive).toBe(false)
    // **جلسةُ المنهاجِ حضورٌ بلا علامات** — تُحتسب حضوراً ولا تُلوَّث بعلامةِ صفرٍ كاذبة.
    const curriculumRow = byCircle.get(w.circleId)
    expect(curriculumRow?.inactive).toBe(false)
    expect(curriculumRow?.gradePct).toBe(0)
    expect(curriculumRow?.attendancePct).toBeGreaterThan(0)
  })

  it("**ق-٩٢**: التقدّمُ مشتقٌّ من **المعتمَد وحده** — والتسجيلُ لا يحرّكه", () => {
    const w = seedWorld()
    const done = recordCurriculumDay(w)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const derived = curriculumProgress(
      w.education,
      educationContext(w, { approvedLessonIds: [done.value.id] }),
      w.circleId,
    )
    expect(derived.ok).toBe(true)
    if (!derived.ok) return
    const completed = derived.value.rows.flatMap((r) => r.cells.filter((c) => c.completed))
    expect(completed).toHaveLength(2)
    expect(completed.every((c) => c.source === "derived")).toBe(true)
  })

  it("**ق-٨٥**: نوعُ اعتمادٍ **واحدٌ للجلسة لا اثنان** — ووحدةُ الكيان لم تسجّل نوعاً قطّ", () => {
    // **الدليلُ محتوائيّ**: مسحُ نقطة تمديد المحرّك — ولا نوعَ باسم وحدة السجل.
    const registeredDir = join(FEATURES_DIR, "approval/registered")
    const registrations = readdirSync(registeredDir).filter((f) => f.endsWith(".ts"))
    expect(registrations).not.toContain("circleLog.ts")

    // **نوعُ الجلسة**: مَن يُعلن كيانَه «درسَ الحلقة» — لا مَن يذكر الفترةَ (يذكرُها الكلّ).
    const lessonTypes = registrations.filter((f) =>
      /entityAr:\s*"[^"]*درسُ الحلقة/.test(readFileSync(join(registeredDir, f), "utf8")),
    )
    expect(lessonTypes, `نوعا اعتمادٍ لشيءٍ واحد: ${lessonTypes.join(" · ")}`).toEqual([
      "education.ts",
    ])

    // **وصفر منطقِ اعتمادٍ في وحدة الكيان** — ولا مفردةَ بتٍّ ولا توجيه (G22 نظيراً).
    const FORBIDDEN = ["approve", "approver", "breakglass", "nessa"]
    const offenders: string[] = []
    for (const file of unifiedFiles().filter((f) => within(f).startsWith("circleLog/"))) {
      const lowered = code(file).toLowerCase()
      for (const token of FORBIDDEN) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) offenders.push(within(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it("**ق-٨٥/ق-٨**: المقفلةُ لا يُكتب عليها — والقفلُ **سؤالٌ عن حالٍ** لا حقلٌ مخزَّن", () => {
    const w = seedWorld()
    const first = recordCurriculumDay(w)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const locked = recordLesson(
      w.education,
      educationContext(w, { approvedLessonIds: [first.value.id] }),
      {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 90,
        presentEnrollmentIds: [w.enrollmentIds[0]!],
      },
    )
    expect(locked.ok === false && locked.error.code).toBe("LESSON_LOCKED")
  })

  it("**ق-٨٦**: الواجهةُ المعلنة باقيةٌ، و**المعتمَدُ وحده** يُحتسب دقائقَ لا مالاً", () => {
    const w = seedWorld()
    const approved = recordCurriculumDay(w, HELD_AT, 90)
    const plain = recordCurriculumDay(w, NEXT_DAY, 45)
    expect(approved.ok && plain.ok).toBe(true)
    if (!approved.ok || !plain.ok) return

    const load = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [approved.value.id] }),
      {
        teacherPersonId: "u-teacher",
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: new Date("2026-08-01T00:00:00.000Z"),
      },
    )
    expect(load.ok, load.ok === false ? load.error.code : "").toBe(true)
    if (!load.ok) return
    expect(load.value.totalMinutes).toBe(90)
    expect(load.value.totalLessonCount).toBe(1)
    expect(load.value.lines[0]?.lessonIds).toEqual([approved.value.id])
    // **دقائقُ لا نقود** — لا حقلَ مبلغٍ في الحصيلة إطلاقاً.
    expect(Object.keys(load.value.lines[0]!)).not.toContain("amount")
  })

  it("**والاشتقاقاتُ القائمة لم تسقط**: كشفُ اليوم وسجلُّ الطالب يعملان على الشكلين", () => {
    const w = seedWorld()
    expect(recordRecitationDay(w).ok).toBe(true)
    expect(recordCurriculumDay(w).ok).toBe(true)
    const ctx = logContextOf(w)

    const curriculumDay = circleDayView(w.log, ctx, { circleId: w.circleId, at: HELD_AT })
    expect(curriculumDay.ok).toBe(true)
    if (!curriculumDay.ok) return
    expect(curriculumDay.value.shape).toBe("curriculum")
    expect(curriculumDay.value.companion?.durationMinutes).toBe(60)
    // **الغائبُ سطرٌ لا فراغ** — الكشفُ يبدأ من سجلّ العضوية في الشكلين.
    expect(curriculumDay.value.rows).toHaveLength(3)

    const recitationDay = circleDayView(w.log, ctx, { circleId: w.tahfeezCircleId, at: HELD_AT })
    expect(recitationDay.ok && recitationDay.value.shape).toBe("recitation")
    expect(recitationDay.ok && recitationDay.value.companion).toBe(null)

    const record = studentRecordView(w.log, ctx, {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[0]!,
    })
    expect(record.ok).toBe(true)
    if (!record.ok) return
    expect(record.value.days[0]?.shape).toBe("curriculum")
    expect(record.value.days[0]?.curriculumSessionId).toBe(SESSION_A)
    expect(record.value.averageGrade).toBe(null)
  })
})

// ── ٨ ───────────────────────────────────────────────────────────────────────

describe("T22/٨ — **عزلُ الشبكة والنطاق**، ومصفوفةُ الشاشات بالغياب المقرون برفض الخادم", () => {
  it("**عزلُ الشبكة بنيويّ**: مستودعُ شبكةٍ ثانيةٍ لا يرى جلسةَ الأولى ولو تطابق المسار", () => {
    const w = seedWorld()
    expect(recordCurriculumDay(w).ok).toBe(true)
    expect(w.log.sessions()).toHaveLength(1)

    const otherTenant = new CircleLogStore(SECOND_TENANT_ID)
    expect(otherTenant.sessions()).toHaveLength(0)
    const stored = w.log.sessions()[0]!
    expect(otherTenant.getSession(stored.circleId, stored.dayKey, stored.periodId)).toBe(null)
    // والشبكةُ **تُختم من المستودع لا من المدخل**.
    expect(stored.tenantId).toBe(w.log.tenantId)
  })

  it("**وعزلُ النطاق**: أميرُ مسجدٍ آخرَ مرفوضٌ في الخادم على المسارين", async () => {
    const w = seedWorld()
    const ep = makeEducationEndpoints(
      w.education,
      educationPorts(w),
      SETTINGS,
      () => false,
      circleDays(w),
    )
    const outsider = canonicalActor("u-amir-omar")
    const r = await ep.recordByOwner.invoke(
      {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: [w.enrollmentIds[0]!],
      },
      outsider,
      WRITE,
    )
    expect(r.ok, "أميرُ مسجدٍ آخرَ سجّل على حلقةٍ ليست في وحدته").toBe(false)
  })

  it("**والغيابُ مقرونٌ برفض الخادم**: موطنُ الجلسة شاشةٌ واحدةٌ بقدراتها المعلنة", () => {
    const screens = registeredScreens()
    const home = screens.find((s) => s.contract.route === "/mosque/circles/log")
    const lessons = screens.find((s) => s.contract.route === "/mosque/circles/lessons")
    expect(home).toBeDefined()
    expect(lessons).toBeDefined()
    // موطنُ الكيان يعلن **قدرتَي ك-٣**: الإدخالُ `circle.manage` والعرضُ `circle.view`.
    expect(home!.contract.capabilities).toContain("circle.manage")
    expect(home!.contract.capabilities).toContain("circle.view")
    // وشاشةُ التقدّم **لا تدّعي موطنَ الدرس** ولا تُنشئه — عرضٌ منسوبٌ فوق كيانٍ له موطن.
    expect([...lessons!.contract.canonicalHome]).toEqual(["curriculumProgress"])
  })
})

// ── تركيبُ المنفذ: الحدودُ التي لا تُبلَغ إلا بخطأ تركيب ─────────────────────────

describe("T22/تركيب — حدودُ منفذ الجلسة: **لا تخضرّ عند الغموض**", () => {
  it("جلسةُ التحفيظ **لا تظهر** لوحدة التعليم — فليست «درساً بلا مجلس»", () => {
    const w = seedWorld()
    expect(recordRecitationDay(w).ok).toBe(true)
    const days = circleDays(w)("u-teacher", NOW)
    expect(days.ofCircle(w.tahfeezCircleId)).toEqual([])
    expect(days.ofTeacher("u-teacher")).toEqual([])
    expect(days.byId(w.log.sessions()[0]!.id)).toBe(null)
  })

  it("**والمكانُ والصورُ اختياريّان**: غيابُهما لا يُمرَّر `undefined` ولا يُخترع فراغاً", () => {
    const w = seedWorld()
    const done = recordCurriculumDay(w)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.venueAr).toBe(null)
    expect(done.value.photoKeys).toEqual([])
    expect(done.value.recordedBy).toBe("u-teacher")
  })

  it("**ورمزٌ غيرُ مترجَمٍ من موطن الجلسة يُلقى** ولا يُبتلع صامتاً (قاعدةُ CR-011)", () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 0,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    // مدةٌ غيرُ صالحة ⇒ رمزٌ **مترجَمٌ** بمفردتنا المعلنة.
    expect(done.ok === false && done.error.code).toBe("INVALID_DURATION")
  })
})
