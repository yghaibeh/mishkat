/**
 * المادة ٨/٤ — **تحقّقُ النوع والحجم في الخادم** (عقدُ الوحدة §٧).
 *
 * «إخفاءُ الزر ليس حماية» يسري على الرفع كما يسري على الأفعال: لوحةُ الرفع في الواجهة
 * تُرشد المستخدم، **والقرارُ هنا**. ثلاثةُ حرّاسٍ بترتيبٍ مقصود:
 *  ١. **المحظورُ لا تفتحه بياناتٌ**: الصيغةُ القابلةُ للتنفيذ مرفوضةٌ **قبل** سؤال القاموس —
 *     فلو أُدخلت في المرجع سهواً لبقيت مرفوضة (ت-٥: نصٌّ يُنفَّذ داخل الملف).
 *     البياناتُ **توسّع المسموح ولا تفتح المحظور**.
 *  ٢. **المسموحُ قاموسٌ مغلقٌ بياناتٌ مرجعية** (قب-٦): غيرُ المسجَّل يُرفض، والمُعطَّل يُرفض
 *     **بسببٍ مختلف** — فيعرف الأدمنُ أيُعيد تفعيلَه أم يضيفه.
 *  ٣. **الحجمُ إعدادٌ حيّ** لا رقمٌ في الكود (G14). وهو مسجَّلٌ **بلا افتراضيٍّ عمداً**
 *     (ق-م-٢: «يُملأ من الإنتاج لا باختراع رقم») ⇒ **غيرُ المضبوط يعني لا رفع**، نظيرَ
 *     `NO_SCOPE`: يُقفل ولا يُفتح.
 */

import type { LibraryStore } from "../data/store.js"
import type { LibraryContext } from "./context.js"
import { libraryErr, libraryOk, type LibraryFormat, type LibraryResult } from "../types.js"

/** إعدادُ سقف الحجم — معرّفُه من السجل المركزيّ، والقيمةُ منه لا من هنا. */
const MAX_BYTES_SETTING = "platform.upload.max_bytes"

/**
 * الصيغُ القابلةُ للتنفيذ — **حظرٌ ثابتٌ في الكود عن قصد** وليس رقماً تشغيلياً:
 * ضبطُه يكسر الأمن لا يعدّل سلوك عمل (`SPEC_settings` §٢-٤: ما يُترك صلباً وسببُه أمنيّ).
 */
const EXECUTABLE_MARKERS = ["svg", "xml", "html", "script"] as const

function isExecutableContent(contentType: string): boolean {
  const lowered = contentType.toLowerCase()
  return EXECUTABLE_MARKERS.some((marker) => lowered.includes(marker))
}

/**
 * سقفُ الحجم من الإعدادات، أو `null` إن كان **غيرَ مضبوط**.
 * المُحلِّلُ يرمي على إعدادٍ بلا افتراضيٍّ ولا ضبط (وهو تصميمُه: «لا تخترع رقماً»)،
 * فتُترجَم الرميةُ هنا إلى **قيمةِ رفضٍ معلنة** — لا استثناءٌ يعبر إلى الحدّ (المادة ٣/٤).
 */
function configuredMaxBytes(ctx: LibraryContext, unitPath: string): number | null {
  try {
    const value = ctx.settings(MAX_BYTES_SETTING, unitPath, ctx.now)
    return typeof value === "number" ? value : null
  } catch {
    return null
  }
}

export type UploadCandidate = {
  readonly contentType: string
  readonly sizeBytes: number
}

/** يعيد الصيغةَ المقبولة، أو سببَ الرفض المُشخِّص. */
export function validateUpload(
  store: LibraryStore,
  ctx: LibraryContext,
  unitPath: string,
  candidate: UploadCandidate,
): LibraryResult<LibraryFormat> {
  if (isExecutableContent(candidate.contentType)) {
    return libraryErr("EXECUTABLE_MEDIA_REJECTED", candidate.contentType)
  }

  const format = store.formatByContentType(candidate.contentType)
  if (format === null) return libraryErr("UNSUPPORTED_CONTENT_TYPE", candidate.contentType)
  if (!format.active) return libraryErr("FORMAT_INACTIVE", format.id)

  if (candidate.sizeBytes <= 0) return libraryErr("EMPTY_FILE", String(candidate.sizeBytes))

  const maxBytes = configuredMaxBytes(ctx, unitPath)
  if (maxBytes === null) return libraryErr("UPLOAD_LIMIT_UNSET", MAX_BYTES_SETTING)
  if (candidate.sizeBytes > maxBytes) {
    return libraryErr("FILE_TOO_LARGE", String(candidate.sizeBytes))
  }

  return libraryOk(format)
}

/**
 * حدودُ الرفع كما يفرضها **الخادم** — تُرسَل للواجهة لتُرشد بها لوحةُ الرفع.
 * **نسخةٌ واحدةٌ للحقيقة** (المادة ١/٢): الواجهةُ لا تحمل قائمةَ صيغٍ ولا سقفَ حجمٍ خاصاً
 * بها، فيستحيل أن تدعو المستخدمَ إلى ما يرفضه الخادم. والحدُّ غيرُ المضبوط يصل **صفراً**
 * — فلا يُعرض بابُ رفعٍ مفتوحٌ خلفه رفضٌ مؤكّد.
 */
export type UploadLimits = {
  readonly acceptedTypes: readonly string[]
  readonly maxBytes: number
}

export function uploadLimits(
  store: LibraryStore,
  ctx: LibraryContext,
  unitPath: string,
): UploadLimits {
  return {
    acceptedTypes: store
      .formats()
      .filter((f) => f.active && !isExecutableContent(f.contentType))
      .map((f) => f.contentType),
    maxBytes: configuredMaxBytes(ctx, unitPath) ?? 0,
  }
}
