/**
 * **ملفُّ الوصل الوحيد** بين هذه الوحدة و**موطن الجلسة اليومية** (CR-016، عقدُ الوحدة §١-ب).
 *
 * كلُّ ما تعرفه هذه الوحدةُ عن الجلسة اليومية يمرّ من هنا — **بنفس نمط `circleLog ← circles`
 * القائم**، وهو مقصودٌ ويُقاس بالمحتوى (`single-circle-entity.test.ts`): **ملفٌّ واحدٌ يستورد
 * `circleLog`، وما عداه يسأل منفذاً**. والحارسُ يفشل عند اثنين **وعند صفر**:
 *  - **اثنان** ⇒ معرفةُ كيانِ غيرِنا تسرّبت إلى خدماتنا، فصار تبديلُه يمسّ الوحدةَ كلَّها.
 *  - **صفر** ⇒ **أُعيد بناءُ الكيان هنا بدل الاتصال به** — وهو بعينه ما وُلد CR-016 لقتله.
 *
 * **وثلاثةُ اتجاهاتٍ تلتقي في هذا الملفّ ولا تختلط**:
 *  ١. **نقرأ** الجلسةَ من موطنها ونُسقطها على ما يخصّنا (`CircleDay`).
 *  ٢. **نكتب** فيها **بكاتبها هو** (`recordCurriculumSession`) — فلا مستودعَ ثانٍ ولا مفتاحَ
 *     طبيعيٌّ ثانٍ ولا «جسرٌ» يزامن سجلّين. **الكاتبُ واحدٌ في موطنه.**
 *  ٣. **نُنفّذ منفذَيه المعلنَين**: «أيَّ شكلٍ يأخذ هذا النوع؟» جوابُه **كتالوجُ مناهجنا**،
 *     و«أمقفلةٌ هذه الجلسة؟» جوابُه **منفذُ الاعتماد المحقون** — فيبقى صاحبُ الكيان جاهلاً
 *     بالمنهاج وبالسلسلة معاً، ونبقى نحن **صفرَ منطقِ اعتماد** (G22).
 *
 * **وترجمةُ المفردات هنا لا في الخدمات**: رموزُ صاحب الكيان تُترجَم إلى **رموزنا المعلنة**
 * (§١١) في جدولٍ واحدٍ ظاهر — فلا يتسرّب معجمُ غيرنا إلى شاشاتنا ولا إلى اختباراتنا.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { CircleLogStore } from "../../circleLog/data/store.js"
import type { CircleModelPort } from "../../circleLog/services/circleModel.js"
import type { SessionContext } from "../../circleLog/services/context.js"
import type { SessionShapePort } from "../../circleLog/services/sessionShape.js"
import { recordCurriculumSession } from "../../circleLog/services/sessions.js"
import type { DaySession } from "../../circleLog/types.js"
import type { EducationStore } from "../data/store.js"
import { curriculumForCircleType } from "./curriculum.js"
import { educationErr, educationOk, type EducationErrorCode, type EducationResult } from "../types.js"
import type {
  CircleDay,
  CircleDayPort,
  LessonApprovalCheck,
  RecordCircleDayInput,
} from "./ports.js"

/**
 * **شكلُ الجلسة من صفوف المنهاج** — تنفيذُ المنفذ الذي أعلنه صاحبُ الكيان.
 *
 * نوعُ حلقةٍ **له منهاجٌ مسجَّل** ⇒ جلستُه جلسةُ منهاج؛ ونوعٌ بلا منهاج ⇒ جلسةُ تحفيظ.
 * **وهذا هو ب-٢٨ حرفياً في طبقةٍ أدنى**: لا اسمَ نوعٍ في الكود، ولا مفتاحَ تفعيل — بل
 * **صفٌّ يربط نوعاً بمنهاج**. فنوعٌ خامسٌ يُضاف صفّاً، ويُربط بمنهاجٍ صفّاً، **فيعمل بلا سطر**.
 */
export function sessionShapeFrom(store: EducationStore): SessionShapePort {
  return {
    shapeOf: (circleTypeId) =>
      curriculumForCircleType(store, circleTypeId) === null ? "recitation" : "curriculum",
  }
}

/**
 * إسقاطُ الجلسة على **ما يخصّ هذه الوحدةَ وحده** — ولا تُعرض إلا جلسةُ **شكل المنهاج**:
 * فجلسةُ التحفيظ ليست «درساً بلا مجلس»، بل **شكلٌ آخر من الكيان نفسِه** لا قاعدةَ لنا عليه.
 */
function dayOf(session: DaySession): CircleDay | null {
  if (session.shape.kind !== "curriculum") return null
  const companion = session.shape.companion
  return {
    id: session.id,
    circleId: session.circleId,
    dayKey: session.dayKey,
    heldAt: session.heldAt,
    curriculumSessionId: companion.curriculumSessionId,
    durationMinutes: companion.durationMinutes,
    venueAr: companion.venueAr,
    photoKeys: companion.photoKeys,
    presentEnrollmentIds: session.rows
      .filter((r) => r.attendance === "present")
      .map((r) => r.enrollmentId),
    rosterEnrollmentIds: session.rows.map((r) => r.enrollmentId),
    recordedBy: session.recordedByPersonId,
  }
}

/**
 * **جدولُ الترجمة** — رمزُ صاحب الكيان ⟵ رمزُنا المعلن (§١١).
 * وهو **ظاهرٌ في موضعٍ واحد**: فمَن غيّر معجمَ أحد الطرفين رأى أثرَه هنا ولم يتفرّق عليه.
 */
const CODE_MAP: Readonly<Record<string, EducationErrorCode>> = Object.freeze({
  UNKNOWN_CIRCLE: "UNKNOWN_CIRCLE",
  CIRCLE_ARCHIVED: "CIRCLE_ARCHIVED",
  SESSION_SHAPE_MISMATCH: "SESSION_SHAPE_MISMATCH",
  FUTURE_DATING_BLOCKED: "FUTURE_DATING_BLOCKED",
  // **المقفلةُ لا يُكتب عليها** — وهي عندنا «الدرسُ المعتمَد لا يُعاد تسجيلُه» (ق-٨).
  SESSION_LOCKED: "LESSON_LOCKED",
  EMPTY_COMPANION_REF: "UNKNOWN_SESSION",
  INVALID_DURATION: "INVALID_DURATION",
  EMPTY_SESSION: "EMPTY_ATTENDANCE",
  DUPLICATE_STUDENT_ROW: "DUPLICATE_ATTENDANCE",
  ENROLLMENT_NOT_IN_CIRCLE: "NOT_ENROLLED",
  EMPTY_PHOTO_KEY: "EMPTY_PHOTO_KEY",
  DUPLICATE_PHOTO_KEY: "DUPLICATE_PHOTO_KEY",
})

/**
 * **لا تخضرّ عند الغموض** (قاعدةُ CR-011 على مستهلِك): رمزٌ لا نعرفه من صاحب الكيان
 * **لا يُبتلع صامتاً** ولا يُترجَم إلى أقربِ شبيه — بل يُلقى حالةً برمجية (المادة ٣/٤)،
 * لأنّ معجماً تغيّر ولم نره **خطأُ تركيبٍ لا خطأُ مستخدم**.
 */
function translate(code: string, detail?: string): EducationResult<never> {
  const mapped = CODE_MAP[code]
  if (mapped === undefined) throw new TypeError(`رمزٌ غيرُ مترجَمٍ من موطن الجلسة: ${code}`)
  return educationErr(mapped, detail)
}

export type CircleDayPortDeps = {
  readonly logStore: CircleLogStore
  readonly education: EducationStore
  readonly circles: CircleModelPort
  readonly settings: SettingsResolver
  /** ق-٨٥ — منفذُ حال الاعتماد؛ وهو **قفلُ الجلسة** عند صاحبها (يسأل عن حالٍ لا عن سلسلة). */
  readonly isLessonApproved: LessonApprovalCheck
}

/**
 * **مصنعُ المنفذ** — يُبنى لكل طلبٍ لأنّ الكتابةَ تحتاج **ساعةَ الطلب وفاعلَه** (لا ساعةً
 * داخلية ولا فاعلاً من المدخل — TESTING_POLICY §٥).
 */
export function circleDaysFrom(
  deps: CircleDayPortDeps,
): (actorPersonId: string, now: Date) => CircleDayPort {
  const { logStore, circles } = deps

  const readAll = (): readonly DaySession[] => logStore.sessions()

  const ofCircle = (circleId: string): readonly CircleDay[] =>
    readAll()
      .filter((s) => s.circleId === circleId)
      .map(dayOf)
      .filter((d): d is CircleDay => d !== null)
      .sort((a, b) => a.id.localeCompare(b.id))

  return (actorPersonId, now) => {
    const logContext: SessionContext = {
      now,
      actorPersonId,
      settings: deps.settings,
      circles,
      shape: sessionShapeFrom(deps.education),
      // **قفلُ الجلسة عندهم هو اعتمادُ الدرس عندنا** — سؤالٌ عن حالٍ، والسلسلةُ في المحرّك.
      isSessionLocked: deps.isLessonApproved,
    }

    return {
      ofCircle,
      ofTeacher: (personId) =>
        circles
          .circlesOfTeacher(personId)
          .flatMap((circle) => ofCircle(circle.id))
          .sort((a, b) => a.id.localeCompare(b.id)),
      byId: (sessionId) => readAll().map(dayOf).find((d) => d?.id === sessionId) ?? null,
      record: (input: RecordCircleDayInput): EducationResult<CircleDay> => {
        const written = recordCurriculumSession(logStore, logContext, {
          circleId: input.circleId,
          at: input.heldAt,
          companion: {
            curriculumSessionId: input.curriculumSessionId,
            durationMinutes: input.durationMinutes,
            ...(input.venueAr === undefined ? {} : { venueAr: input.venueAr }),
            presentEnrollmentIds: input.presentEnrollmentIds,
            ...(input.photoKeys === undefined ? {} : { photoKeys: input.photoKeys }),
          },
        })
        if (!written.ok) return translate(written.error.code, written.error.detail)
        const day = dayOf(written.value)
        // حالةٌ برمجيةٌ لا خطأُ عمل: كاتبُ شكل المنهاج **لا يُنتج غيرَ شكل المنهاج**.
        if (day === null) throw new TypeError("جلسةٌ كُتبت بشكل المنهاج وعادت بغيره")
        return educationOk(day)
      },
    }
  }
}
