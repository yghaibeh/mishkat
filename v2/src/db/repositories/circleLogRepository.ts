/**
 * مستودعُ السجلّ اليوميّ على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `CircleLogStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 *
 * ---
 *
 * ## **مصدران لا واحد** — الوصفة §٤-٠
 * · **كتالوجٌ مرجعيٌّ شبكيّ**: السورُ والمصاحفُ **وفتراتُ اليوم** (CR-020) — نطاقُه الجذرُ.
 * · **سجلٌّ تشغيليٌّ بالوحدة**: الجلساتُ وأسطرُها وصورُها والملاحظاتُ والروابط — وهو **أضخمُ
 *   ما في التعليم** (ملحقُ ADR أ: `lesson_attendance` ~٧٤٩ ألفَ صفٍّ/سنة للشبكة).
 *
 * ---
 *
 * ## ⚠️ **مفتاحُ التوجيه يُشتقّ من المنفذ المعلن — ولا يُنسخ إلى الكيان**
 *
 * وهذا **فرقٌ حقيقيٌّ عن العُهد والمكتبة يستحقّ أن يُقال**: هناك كان مفتاحُ التابع يُشتقّ من
 * **أصلٍ يملكه المستودعُ نفسُه** (الأصلُ في العُهد، المادةُ في المكتبة). وهنا **لا كيانَ حلقةٍ
 * في هذا المستودع أصلاً** (ب-٢٨: «لا نسخةَ ثانية للحلقة»)، ويحرسه `single-source.test.ts`
 * نصّاً: أيُّ حقلٍ اسمُه `unitPath` في `types.ts` أو `data/` **يُحمِّر الطقم**.
 *
 * **فجرّبتُ الطريقَ الآخرَ أوّلاً وسقط**: جمّدتُ `unitPath` على الجلسة لحظةَ الكتابة (نظيرُ
 * `targetPath` في زيارة الإشراف) ⟵ **حمُر الحارسُ باسمه**. وهو **حارسٌ مُصيبٌ لا عائق**:
 * تجميدُ الحقل هنا كان **نسخةً ثانيةً لموطن الحلقة** تعيش في وحدةٍ لا تملكه.
 *
 * **فالحلُّ**: يستقبل المصنعُ **قارئَ مسارٍ واحداً** (`CirclePathReader`) يصله المُركِّبُ
 * بالمصدر الواحد؛ فيُشتقّ المسارُ **من موطن الحلقة الحيّ** لحظةَ الإسقاط.
 * **وحلقةٌ مجهولةٌ ⟵ رميةٌ** لا توجيهٌ إلى الجذر صامتاً (نظيرُ `requestPath` في `orgRepository`).
 *
 * > **وهو دالّةٌ لا منفذٌ كامل — والحدُّ مقصود**: طبقةُ البيانات **لا تستورد من `services`**
 * > (المادة ٣/١ · حارسُ الطبقات)، وهي لا تحتاج إلا سؤالاً واحداً. فأضيقُ عقدٍ يكفي **أصدقُ**
 * > من منفذٍ كاملٍ تُستورد منه أربعةُ أسئلةٍ لا تُسأل.
 *
 * > **وهو آمنٌ بدليلٍ بنيويّ**: `UpdateCircleInput` في وحدة الحلقات **ليس فيه حقلُ وحدة**،
 * > فلا سطحَ ينقل حلقةً بين وحدتين ⟵ **مسارُ الجلسة لا يتحرّك بعد كتابتها** (الوصفة فخّ ٤).
 *
 * ---
 *
 * ### وفرقان آخران عن القالب
 * ١. **لا سجلَّ تدقيقٍ محليّ** — تدقيقُ الوحدة على `defineServerFn.audit` (كحال `library`
 *    و`circles`)، فبند CR-027 **غيرُ ذي موضوع**، ووحدةُ العمل **بلا `AuditJournal`**.
 * ٢. **لا عدّادَ مشتقّ** — الحضورُ والمتوسّطُ والترتيبُ **استعلاماتٌ لحظةَ السؤال** (ق-٩١/٩٢)،
 *    **صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس** (README §٤). وهو بعينه علاجُ ع-١٢/ع-١٩/ع-٢٩.
 */

import { encodeDate, encodeNullable, readDate, readDateOrNull, readInt, readIntOrNull, readText, readTextOrNull } from "../encode.js"
import { tableSpec, TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { CircleLogStore } from "../../features/circleLog/data/store.js"
import type {
  AttendanceMark,
  CurriculumCompanion,
  Recitation,
  SessionRow,
  SessionShape,
} from "../../features/circleLog/types.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "circleLog.catalog"
const ENTRIES_SOURCE = "circleLog.entries"
const SEQUENCE = "circleLog.seq"

/**
 * سقفُ **الكتالوج** (G23 · §٤-٠) — حمولةٌ **مقيَّدةٌ بنيوياً**: ١١٤ سورةً (عددٌ ثابتٌ لا ينمو)
 * + مصاحفُ معدودة + فتراتُ اليوم (اثنتان في أسخى الأحوال — CR-020). **لا ينمو أيٌّ منها مع
 * الميدان**: لا مع المساجد ولا الحلقات ولا الطلاب.
 * فالسقفُ **١٬٠٠٠** هامشٌ ~٨× على ~١٢٠ صفّاً مقيسةً بنيوياً.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **السجلّ التشغيليّ** (G23 · CR-026 ب · قب-٤٨ · CR-030) — **وهذا أخطرُ سقفٍ في الموجة،
 * وقد سمّته الوصفة §٧ صراحةً: «أرجّح أن أوّلَ إخفاقٍ لـG23 يقع في `dailyLog` أو `circleLog`».**
 *
 * ### الرقمُ المقيس أوّلاً — بلا تجميل
 * ملحقُ ADR أ: `lesson_attendance` = **٩٦٠ حلقة × ١٥ طالباً × ٥٢ جلسة = ٧٤٩٬٠٠٠ صفٍّ/سنة**
 * للشبكة كلِّها؛ وبالاحتفاظ سنتين (قب-٦) ⟵ **~١.٥ مليون**. ومع CR-020 قد تعقد حلقةٌ فترتين
 * في اليوم، فالسقفُ النظريُّ أعلى. **فالشبكةُ كلُّها لا تُحمَّل في وحدة عملٍ متزامنة، ولا
 * يُدّعى غيرُ ذلك.**
 *
 * ### السطحُ القارئ — **باسمه** (CR-030)، وترتيبُ العلاج (README الحسم ٤)
 * ١. **`circle.log.day.view` · `circle.log.record` · `circle.student.record.view` · الملاحظاتُ
 *    والروابط**: نطاقُها `circleScope` — **وحدةُ حلقةٍ بعينها**. وهذه **٩٥٪ من الاستعمال**.
 * ٢. **`circle.ranking.view`**: نطاقُه `unitById(input.unitId)` — **أيُّ وحدةٍ بمعرّفها**.
 *    وهو **السطحُ الوحيد الذي يتّسع**، وقدرتُه `circle.view` من نوع `subtree`.
 *
 * **والتضييقُ بالمسار هو العلاجُ الأول وقد طُبِّق**: الجلساتُ **نمطٌ (أ)** خالص (تشغيليٌّ
 * بالوحدة) — فجلسةُ مسجدٍ تُحمّل مسجدَها وحدَه. **والفصلُ (§٤-٠) طُبِّق كذلك**: قراءةُ كتالوج
 * السور بالجذر لم تعد تجرّ صفَّ حضورٍ واحداً.
 *
 * ### فأين يُسنَد السقف؟ — **إلى ما تسنّه ق-٩١ نصّاً، لا إلى ما يحتمله السطح**
 * ق-٩١: «ترتيبُ الحلقات **للأمير في مسجده وللمشرف في نطاقه**، **ولا ترتيب فردياً للمدير**».
 * فأوسعُ قراءةٍ **تسنّها القاعدة** نطاقُ مشرف (مربّعٌ/رابطة ~١٠ مساجد):
 *  · حلقاتُه ~**٢٤** (٩٦٠ ÷ ٤٠٠ مسجدٍ × ١٠) · أسطرُ الحضور ٢٤ × ١٥ × ٥٢ × سنتين ⟵ **~٣٧٬٤٠٠**
 *  · جلساتُه ٢٤ × ٥٢ × ٢ ⟵ **~٢٬٥٠٠** · صورٌ وملاحظاتٌ وروابطُ ⟵ **~٢٬٠٠٠** (تقدير)
 *  ⟵ **~٤٢٬٠٠٠**، والسقفُ **٦٠٬٠٠٠** يتركه بهامشٍ ~١.٤×. وجلسةُ **مسجدٍ** ~**٤٬٥٠٠**.
 *
 * > ### ⚠️ فجوةٌ مُصرَّحٌ بها لا مطموسة — **`CR-DRAFT-circleLog-ranking-scope`**
 * > **السطحُ أوسعُ ممّا تسنّه القاعدة**: `circle.ranking.view` يقبل **أيَّ** معرّف وحدة، ومنها
 * > عقدةُ الشبكة؛ فحاملُ `circle.view` على الجذر يستطيع طلبَ ترتيبٍ **شبكيّ** — وهو ما تنفيه
 * > ق-٩١ نصّاً («لا ترتيب فردياً للمدير»). وحينها **يرمي G23 مُسمّياً المصدرَ والجدول**.
 * >
 * > **وهذا هو السلوكُ المطلوب لا عطبٌ**: *«أوّلُ تجاوزٍ ليس تضخّمَ بياناتٍ بل **قراءةٌ وسّعت
 * > النطاق**»* (قب-٤٨). ورفعُ السقف إلى ١.٥ مليون **يحرس صفراً** (§٤-٠: سقفٌ بحجم الشبكة لا
 * > يحرس شيئاً) — والسؤالُ الصحيح الذي تطرحه CR-030 هو: **أيتّسع بدليلٍ أم يُضيَّق السطح؟**
 * > **وجوابُه ليس لي**: تضييقُ السطح يمسّ نطاقَ دالّةِ خادمٍ مُعلَنة والمصفوفةَ الذهبية،
 * > فرُفعت المسوّدة **بلا ترقيم** ولم أقرّر (`PARALLEL_WORK` §٩).
 * >
 * > **ولم أُنقدح زنادَ CR-026**: نصُّه *«إخفاقٌ **يتعذّر** إصلاحُه بتضييق النطاق»* — وهذا
 * > **يُصلَح بتضييق السطح**، وهو أرخصُ وأصحُّ من قلب العقود إلى `async`. **والزنادُ صمّامُ
 * > أمانٍ لا يُحرق على حالةٍ لها علاجٌ أرخص** (تصحيحُ CR-029 · T26-ج).
 */
const ENTRIES_ROW_BUDGET = 60_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/**
 * **نطاقُ الحفظ/المراجعة شكلٌ واحدٌ بمميِّز** (ق-٨٩): `mode` يقول أسورةٌ أم صفحات، والوجهان
 * **متساويا الأضلاع** — فلا أربعةَ عشرَ عموداً لوجهين، ولا `JSON` في عمودٍ (ع-٣).
 */
type RecitationColumns = {
  readonly mode: string | null
  readonly ref: string | null
  readonly from: number | null
  readonly to: number | null
}

function recitationColumns(recitation: Recitation | null): RecitationColumns {
  if (recitation === null) return { mode: null, ref: null, from: null, to: null }
  return recitation.mode === "surah"
    ? { mode: "surah", ref: recitation.surahId, from: recitation.fromAyah, to: recitation.toAyah }
    : { mode: "pages", ref: recitation.mushafId, from: recitation.fromPage, to: recitation.toPage }
}

function readRecitation(row: SqlRow, prefix: string): Recitation | null {
  const mode = readTextOrNull(row, `${prefix}_mode`)
  if (mode === null) return null
  const ref = readText(row, `${prefix}_ref`)
  const from = readInt(row, `${prefix}_from`)
  const to = readInt(row, `${prefix}_to`)
  return mode === "surah"
    ? { mode: "surah", surahId: ref, fromAyah: from, toAyah: to }
    : { mode: "pages", mushafId: ref, fromPage: from, toPage: to }
}

/**
 * **الكتالوجُ المرجعيّ** — السورُ والمصاحفُ وفتراتُ اليوم، نطاقُها **جذرُ الشبكة**.
 * مصدرٌ مستقلٌّ بحكم §٤-٠: قراءتُه لا تجرّ سطرَ حضورٍ واحداً.
 */
export function persistentCircleLogCatalog(store: CircleLogStore): PersistentStore {
  const tenantId = store.tenantId
  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: ["circlelog_surahs", "circlelog_mushafs", "circlelog_periods"],

    project: () =>
      new Map([
        collect(
          store.surahs().map((surah) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: surah.id,
            ar: surah.ar,
            ayah_count: surah.ayahCount,
          })),
          "circlelog_surahs",
        ),
        collect(
          store.mushafs().map((mushaf) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: mushaf.id,
            ar: mushaf.ar,
            page_count: mushaf.pageCount,
          })),
          "circlelog_mushafs",
        ),
        collect(
          store.periods().map((period) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: period.id,
            ar: period.ar,
            ordinal: period.ordinal,
          })),
          "circlelog_periods",
        ),
      ]),

    load: (rows) => {
      for (const row of table(rows, "circlelog_surahs").values()) {
        store.saveSurah({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          ayahCount: readInt(row, "ayah_count"),
        })
      }
      for (const row of table(rows, "circlelog_mushafs").values()) {
        store.saveMushaf({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          pageCount: readInt(row, "page_count"),
        })
      }
      for (const row of table(rows, "circlelog_periods").values()) {
        store.savePeriod({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          ordinal: readInt(row, "ordinal"),
        })
      }
    },
  }
}

/**
 * **السجلُّ التشغيليّ** — الجلساتُ وأسطرُها وصورُها والملاحظاتُ والروابط، ونطاقُها **مسارُ
 * وحدة حلقتها** يُشتقّ من `CircleModelPort` (انظر رأسَ الملفّ: لا نسخةَ حقلٍ في الكيان).
 */
export type CirclePathReader = (circleId: string) => string | null

export function persistentCircleLogEntries(
  store: CircleLogStore,
  circlePathOf: CirclePathReader,
): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ التوجيه **من موطن الحلقة الحيّ** — ومجهولُ الحلقة **يُرمى** لا يُوجَّه إلى الجذر. */
  const circlePath = (circleId: string, what: string): string => {
    const path = circlePathOf(circleId)
    if (path === null) {
      throw new Error(`مفتاحُ توجيهٍ لا يُشتقّ: ${what} يشير إلى حلقةٍ مجهولة ${circleId}`)
    }
    return path
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const session of store.sessions()) max = Math.max(max, suffixOf(session.id))
    for (const note of store.notes()) max = Math.max(max, suffixOf(note.id))
    for (const link of store.links()) max = Math.max(max, suffixOf(link.id))
    return max
  }

  const shapeColumns = (shape: SessionShape) =>
    shape.kind === "curriculum"
      ? {
          shape_kind: shape.kind,
          curriculum_session_id: shape.companion.curriculumSessionId,
          duration_minutes: shape.companion.durationMinutes,
          venue_ar: shape.companion.venueAr,
        }
      : {
          shape_kind: shape.kind,
          curriculum_session_id: null,
          duration_minutes: null,
          venue_ar: null,
        }

  return {
    name: ENTRIES_SOURCE,
    rowBudget: ENTRIES_ROW_BUDGET,
    tables: [
      "circlelog_sessions",
      "circlelog_session_rows",
      "circlelog_session_photos",
      "circlelog_notes",
      "circlelog_links",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () => {
      const sessionRows: SqlRow[] = []
      const photoRows: SqlRow[] = []
      const sessions = store.sessions().map((session) => {
        const unitPath = circlePath(session.circleId, `جلسةُ ${session.id}`)
        for (const row of session.rows) {
          const memo = recitationColumns(row.evaluation?.memorization ?? null)
          const review = recitationColumns(row.evaluation?.review ?? null)
          sessionRows.push({
            tenant_id: tenantId,
            unit_path: unitPath,
            session_id: session.id,
            enrollment_id: row.enrollmentId,
            attendance: row.attendance,
            memo_mode: memo.mode,
            memo_ref: memo.ref,
            memo_from: memo.from,
            memo_to: memo.to,
            memo_grade: row.evaluation?.memorizationGrade ?? null,
            review_mode: review.mode,
            review_ref: review.ref,
            review_from: review.from,
            review_to: review.to,
            review_grade: row.evaluation?.reviewGrade ?? null,
            tajweed_grade: row.evaluation?.tajweedGrade ?? null,
            enrichment_type_id: row.evaluation?.enrichment?.typeId ?? null,
            enrichment_grade: row.evaluation?.enrichment?.grade ?? null,
          })
        }
        if (session.shape.kind === "curriculum") {
          session.shape.companion.photoKeys.forEach((key, ordinal) => {
            photoRows.push({
              tenant_id: tenantId,
              unit_path: unitPath,
              session_id: session.id,
              ordinal,
              photo_key: key,
            })
          })
        }
        return {
          tenant_id: tenantId,
          unit_path: unitPath,
          circle_id: session.circleId,
          day_key: session.dayKey,
          period_id: session.periodId,
          id: session.id,
          ...shapeColumns(session.shape),
          held_at: encodeDate(session.heldAt),
          recorded_by_person_id: session.recordedByPersonId,
          recorded_at: encodeDate(session.recordedAt),
        }
      })

      return new Map([
        collect(sessions, "circlelog_sessions"),
        collect(sessionRows, "circlelog_session_rows"),
        collect(photoRows, "circlelog_session_photos"),
        collect(
          store.notes().map((note) => ({
            tenant_id: tenantId,
            unit_path: circlePath(note.circleId, `ملاحظةُ ${note.id}`),
            id: note.id,
            circle_id: note.circleId,
            body_ar: note.bodyAr,
            author_person_id: note.authorPersonId,
            written_at: encodeDate(note.writtenAt),
          })),
          "circlelog_notes",
        ),
        collect(
          store.links().map((link) => ({
            tenant_id: tenantId,
            unit_path: circlePath(link.circleId, `رابطُ ${link.id}`),
            id: link.id,
            token: link.token,
            enrollment_id: link.enrollmentId,
            circle_id: link.circleId,
            issued_at: encodeDate(link.issuedAt),
            expires_at: encodeDate(link.expiresAt),
            revoked_at: encodeNullable(link.revokedAt, encodeDate),
          })),
          "circlelog_links",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ])
    },

    load: (rows) => {
      // أسطرُ الجلسات وصورُها **تُجمَّع بمعرّف جلستها** قبل بناء الكيان — فالكيانُ يُبنى مرّةً
      // واحدةً كاملاً، ولا يُكتب على المستودع مرّتين لجلسةٍ واحدة.
      const rowsBySession = new Map<string, SessionRow[]>()
      for (const row of table(rows, "circlelog_session_rows").values()) {
        const sessionId = readText(row, "session_id")
        const enrichmentTypeId = readTextOrNull(row, "enrichment_type_id")
        const bucket = rowsBySession.get(sessionId) ?? []
        bucket.push({
          enrollmentId: readText(row, "enrollment_id"),
          attendance: readText(row, "attendance") as AttendanceMark,
          // **الحقولُ تتبع الشكل** (CR-016): تُبنى مجموعةُ التقييم أدناه حين يكون الشكلُ تحفيظاً،
          // و`null` وإلا — فلا يُخترع حقلٌ لا وجودَ له في الكيان.
          evaluation: {
            memorization: readRecitation(row, "memo"),
            memorizationGrade: readIntOrNull(row, "memo_grade"),
            review: readRecitation(row, "review"),
            reviewGrade: readIntOrNull(row, "review_grade"),
            tajweedGrade: readIntOrNull(row, "tajweed_grade"),
            enrichment:
              enrichmentTypeId === null
                ? null
                : { typeId: enrichmentTypeId, grade: readIntOrNull(row, "enrichment_grade") },
          },
        })
        rowsBySession.set(sessionId, bucket)
      }

      const photosBySession = new Map<string, { ordinal: number; key: string }[]>()
      for (const row of table(rows, "circlelog_session_photos").values()) {
        const sessionId = readText(row, "session_id")
        const bucket = photosBySession.get(sessionId) ?? []
        bucket.push({ ordinal: readInt(row, "ordinal"), key: readText(row, "photo_key") })
        photosBySession.set(sessionId, bucket)
      }

      for (const row of table(rows, "circlelog_sessions").values()) {
        const id = readText(row, "id")
        const kind = readText(row, "shape_kind")
        const ordered = (rowsBySession.get(id) ?? []).sort((a, b) =>
          a.enrollmentId.localeCompare(b.enrollmentId),
        )
        const companion: CurriculumCompanion = {
          curriculumSessionId: readTextOrNull(row, "curriculum_session_id") ?? "",
          durationMinutes: readIntOrNull(row, "duration_minutes") ?? 0,
          venueAr: readTextOrNull(row, "venue_ar"),
          photoKeys: (photosBySession.get(id) ?? [])
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((p) => p.key),
        }
        store.upsertSession({
          tenantId,
          id,
          circleId: readText(row, "circle_id"),
          dayKey: readText(row, "day_key"),
          periodId: readText(row, "period_id"),
          heldAt: readDate(row, "held_at"),
          shape: kind === "curriculum" ? { kind, companion } : { kind: "recitation" },
          // **جلسةُ المنهاج بلا تقييمِ حفظٍ أصلاً** — فغيابُ الحقل لا فراغُه (CR-016).
          rows: kind === "curriculum" ? ordered.map((r) => ({ ...r, evaluation: null })) : ordered,
          recordedByPersonId: readText(row, "recorded_by_person_id"),
          recordedAt: readDate(row, "recorded_at"),
        })
      }

      const notes = [...table(rows, "circlelog_notes").values()].sort(
        (a, b) => suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of notes) {
        store.appendNote({
          tenantId,
          id: readText(row, "id"),
          circleId: readText(row, "circle_id"),
          bodyAr: readText(row, "body_ar"),
          authorPersonId: readText(row, "author_person_id"),
          writtenAt: readDate(row, "written_at"),
        })
      }

      for (const row of table(rows, "circlelog_links").values()) {
        store.saveLink({
          tenantId,
          id: readText(row, "id"),
          token: readText(row, "token"),
          enrollmentId: readText(row, "enrollment_id"),
          circleId: readText(row, "circle_id"),
          issuedAt: readDate(row, "issued_at"),
          expiresAt: readDate(row, "expires_at"),
          revokedAt: readDateOrNull(row, "revoked_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
