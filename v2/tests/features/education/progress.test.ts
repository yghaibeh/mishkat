/**
 * **الاختبارُ الإلزاميّ الثالث** (T19) — **ق-٩٢**: تقدّمُ الطالب في المنهج يتحدّث آلياً
 * **باعتماد الدرس** لا بتسجيله، و**صفر عدّادٍ مخزَّن**.
 *
 * والعطبُ الذي يحرسه: في v1 كان التقدّمُ يُكتب صفّاً عند فعلٍ ما، فينفصل عن الواقع كما انفصل
 * عدّادُ الحلقات (ع-١٩) وعدّادُ حلقات المعلّم (ع-٢٩) — «انفصامُ الكتابة عن القراءة» (ج٥).
 * وفي v2 **لا يوجد ما يتباعد**: المصفوفةُ تُبنى لحظةَ السؤال من المصدر الواحد.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { curriculumProgress, markProgress } from "../../../src/features/education/services/progress.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import {
  educationContext,
  HELD_AT,
  SESSION_A,
  SESSION_B,
  seedWorld,
  type EduWorld,
} from "./_seed.js"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/education", import.meta.url))

function storedSources(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith(".ts")) out.push(path)
    }
  }
  walk(UNIT_DIR)
  return out.filter((f) => f.endsWith("/types.ts") || f.includes("/data/"))
}

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

/** يسجّل درساً على المجلس المُعطى بحضورِ أوّل ملتحقَين، ويعيد معرّفه. */
function recordOn(w: EduWorld, sessionId: string, present: readonly string[]): string {
  const done = recordLesson(w.education, educationContext(w), {
    circleId: w.circleId,
    sessionId,
    heldAt: HELD_AT,
    durationMinutes: 60,
    presentEnrollmentIds: [...present],
  })
  if (!done.ok) throw new Error(done.error.code)
  return done.value.id
}

function cell(
  matrix: { readonly rows: readonly { readonly enrollmentId: string; readonly cells: readonly { readonly sessionId: string; readonly completed: boolean }[] }[] },
  enrollmentId: string,
  sessionId: string,
): boolean {
  const row = matrix.rows.find((r) => r.enrollmentId === enrollmentId)
  return row?.cells.find((c) => c.sessionId === sessionId)?.completed === true
}

describe("**ق-٩٢ — التقدّمُ يتغيّر بالاعتماد لا بالتسجيل**", () => {
  it("المصفوفةُ طلابٌ × مجالسُ منهاجِ نوعِ الحلقة — كلُّها قبل أيّ درسٍ **غيرُ مكتملة**", () => {
    const w = seedWorld()
    const done = curriculumProgress(w.education, educationContext(w), w.circleId)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.sessions.map((s) => s.id)).toEqual([SESSION_A, SESSION_B])
    expect(done.value.rows).toHaveLength(3)
    expect(done.value.completedCells).toBe(0)
    expect(done.value.totalCells).toBe(6)
  })

  it("**درسٌ مسجَّلٌ غيرُ معتمَد لا يحرّك خليّةً واحدة** — التسجيلُ ليس اعتماداً", () => {
    const w = seedWorld()
    const lessonId = recordOn(w, SESSION_A, [w.enrollmentIds[0]!, w.enrollmentIds[1]!])
    const done = curriculumProgress(w.education, educationContext(w), w.circleId)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.completedCells).toBe(0)
    expect(cell(done.value, w.enrollmentIds[0]!, SESSION_A)).toBe(false)
    expect(lessonId).toBeTruthy()
  })

  it("**واعتمادُه وحدَه يُكمل المجلسَ للحاضرين — والغائبُ لا يُكمل**", () => {
    const w = seedWorld()
    const lessonId = recordOn(w, SESSION_A, [w.enrollmentIds[0]!, w.enrollmentIds[1]!])
    const ctx = educationContext(w, { approvedLessonIds: [lessonId] })
    const done = curriculumProgress(w.education, ctx, w.circleId)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(cell(done.value, w.enrollmentIds[0]!, SESSION_A)).toBe(true)
    expect(cell(done.value, w.enrollmentIds[1]!, SESSION_A)).toBe(true)
    // **الغائبُ لم يُكمل**: الاعتمادُ يُكمل الحاضرين وحدهم (ق-٩٢ نصاً).
    expect(cell(done.value, w.enrollmentIds[2]!, SESSION_A)).toBe(false)
    // ومجلسٌ لم يُدرَّس يبقى فارغاً للجميع.
    expect(cell(done.value, w.enrollmentIds[0]!, SESSION_B)).toBe(false)
    expect(done.value.completedCells).toBe(2)
  })

  it("**ونزعُ الاعتماد يُعيد التقدّمَ كما كان** — لأنّه اشتقاقٌ لا صفٌّ يُكتب", () => {
    const w = seedWorld()
    const lessonId = recordOn(w, SESSION_A, [w.enrollmentIds[0]!])
    const approved = curriculumProgress(w.education, educationContext(w, { approvedLessonIds: [lessonId] }), w.circleId)
    const withdrawn = curriculumProgress(w.education, educationContext(w), w.circleId)
    expect(approved.ok && approved.value.completedCells).toBe(1)
    expect(withdrawn.ok && withdrawn.value.completedCells).toBe(0)
  })

  it("وحلقةٌ نوعُها بلا منهاج ⇒ `NO_CURRICULUM_FOR_TYPE`، ومجهولةٌ ⇒ `UNKNOWN_CIRCLE`", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const noCurriculum = curriculumProgress(w.education, ctx, w.tahfeezCircleId)
    expect(noCurriculum.ok === false && noCurriculum.error.code).toBe("NO_CURRICULUM_FOR_TYPE")
    const unknown = curriculumProgress(w.education, ctx, "لا-وجود-لها")
    expect(unknown.ok === false && unknown.error.code).toBe("UNKNOWN_CIRCLE")
  })
})

describe("ق-٩٢ ذيلاً · قب-٩ — **التصحيحُ اليدويّ بصمةٌ فوق الاشتقاق لا عدّادٌ يحلّ محلّه**", () => {
  it("تصحيحٌ يدويٌّ يُكمل خليّةً لم يُكملها الاشتقاق — **بمن/ماذا/متى/لماذا** ظاهرة", () => {
    const w = seedWorld()
    const ctx = educationContext(w, { actorPersonId: "u-amir" })
    const done = markProgress(w.education, ctx, {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[2]!,
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "حضر ولم يُرصد سهواً",
    })
    expect(done.ok, done.ok === false ? done.error.code : "").toBe(true)
    if (!done.ok) return
    expect(done.value.byPersonId).toBe("u-amir")
    expect(done.value.at).toEqual(ctx.now)
    expect(done.value.reasonAr).toBe("حضر ولم يُرصد سهواً")

    const matrix = curriculumProgress(w.education, ctx, w.circleId)
    expect(matrix.ok).toBe(true)
    if (!matrix.ok) return
    expect(cell(matrix.value, w.enrollmentIds[2]!, SESSION_A)).toBe(true)
    const row = matrix.value.rows.find((r) => r.enrollmentId === w.enrollmentIds[2])
    expect(row?.cells.find((c) => c.sessionId === SESSION_A)?.source).toBe("correction")
  })

  it("**والتصحيحُ ينفي كما يُثبت**: تصحيحٌ بـ«لم يُكمل» يغلب اشتقاقاً مكتملاً", () => {
    const w = seedWorld()
    const lessonId = recordOn(w, SESSION_A, [w.enrollmentIds[0]!])
    const ctx = educationContext(w, { actorPersonId: "u-amir", approvedLessonIds: [lessonId] })
    markProgress(w.education, ctx, {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[0]!,
      sessionId: SESSION_A,
      completed: false,
      reasonAr: "رُصد خطأً",
    })
    const matrix = curriculumProgress(w.education, ctx, w.circleId)
    expect(matrix.ok && cell(matrix.value, w.enrollmentIds[0]!, SESSION_A)).toBe(false)
  })

  it("وتصحيحٌ بلا سببٍ ⇒ `EMPTY_REASON`، ولطالبٍ ليس في الحلقة ⇒ `NOT_ENROLLED`", () => {
    const w = seedWorld()
    const ctx = educationContext(w, { actorPersonId: "u-amir" })
    const noReason = markProgress(w.education, ctx, {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[0]!,
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "   ",
    })
    expect(noReason.ok === false && noReason.error.code).toBe("EMPTY_REASON")

    const stranger = markProgress(w.education, ctx, {
      circleId: w.circleId,
      enrollmentId: "enr-غريب",
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "سبب",
    })
    expect(stranger.ok === false && stranger.error.code).toBe("NOT_ENROLLED")

    const stranger2 = markProgress(w.education, ctx, {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[0]!,
      sessionId: "ses-غريب",
      completed: true,
      reasonAr: "سبب",
    })
    expect(stranger2.ok === false && stranger2.error.code).toBe("UNKNOWN_SESSION")
  })
})

/**
 * **الشقُّ البنيويّ من الاختبار الإلزاميّ الثالث** — «صفر عدّادٍ مخزَّن» **دعوى بنيوية**،
 * فتُقاس بالمحتوى لا بالسلوك (درسُ قب-٤٠: حارسٌ سلوكيٌّ يمرّ على بذرته ويفوته الواقع).
 */
describe("**صفر عدّادٍ مخزَّن**: لا حقلَ يحفظ عدداً ولا نسبةً في كيانات الوحدة ولا مستودعها", () => {
  it("`types.ts` و`data/` بلا حقلِ عدٍّ (`count`/`total`/`tally`/`percent`/`progress`)", () => {
    const files = storedSources()
    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (
            /readonly\s+\w*(?:[Cc]ount|[Tt]otal|[Tt]ally|[Nn]umberOf|[Pp]ercent|[Pp]rogress)\w*\s*[?:]/.test(
              line,
            )
          ) {
            offenders.push(`${file}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `عدّادٌ مخزَّن: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا كيانَ «تقدّمٍ» مخزَّنٌ إلا بصمةَ التصحيح** — الاشتقاقُ لا يُحفظ", () => {
    const source = code(join(UNIT_DIR, "types.ts"))
    const entities = [...source.matchAll(/export type (\w+) = \{/g)].map((m) => m[1])
    const progressLike = entities.filter((e) => /progress/i.test(e ?? ""))
    expect(progressLike).toEqual(["ProgressCorrection"])
  })
})
