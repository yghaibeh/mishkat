/**
 * وصفُ المخطط في الكود — **مصدرُ حقيقةٍ واحدٌ لبناء العبارات** (المادة ١/٢).
 *
 * والملفُّ `.sql` هو ما يُطبَّق فعلاً؛ فلئلا يصير مصدرَ حقيقةٍ ثانياً يتباعد،
 * **يُقارن هذا الوصفُ بالمخطط المطبَّق نفسِه** في `tests/migrations/schema.test.ts`
 * (عبر `PRAGMA`) — فأيُّ انحرافٍ يُفشل الطقم. القياسُ على المطبَّق لا على النصّ.
 *
 * **مفتاحُ التوجيه (ع-٥) على كلِّ جدولٍ يحمل بيانات شبكة بلا استثناء** — لأن الاستثناء
 * يحتاج تصنيفاً، والتصنيفُ قائمةٌ تُسرد، والقائمةُ تتخلّف (CR-011/قب-٣٦). التفصيلُ
 * ومسوّغُه في `README.md` الحسم ٢.
 *
 * ---
 *
 * ## وهذا الملفُّ **مُجمِّعٌ لا مُعرِّف** (T26-ب-٢أ)
 *
 * كانت `TABLES` مصفوفةً واحدةً يُلحق بها كلُّ ناقلِ وحدة. وستُّ وحداتٍ تُنقل **على التوازي**
 * كانت ستُلحق بها ستَّ كتلٍ ⟵ **ستةُ تعارضاتٍ في ملفٍّ واحد**؛ **وسجلُّنا في هذا صريح**:
 * الدمجُ الآليّ «أبقِ الاثنين» أخفق **ثلاث مرّات** (قب-٣٦) — كرّر ثابتاً، وبَتَر جسمَ كتلة،
 * وضاعف استيراداً. **ولا يُراهَن على ستٍّ بما أخفق في ثلاث.**
 *
 * فصار وصفُ جداول كلِّ وحدةٍ **في ملفّها** (`schema/<الوحدة>.ts`)، ومساهمةُ الناقل هنا
 * **سطران**: استيرادٌ ونشر. وهما يندمجان بلا تعارض لأنهما **إضافتان في طرفَي قائمتين
 * مرتّبتين**، لا كتلةٌ في وسط مصفوفة. ويقيس السطرين `tests/migrations/schema-partition.test.ts`.
 *
 * > **وترتيبُ الجداول في هذه المصفوفة لا أثرَ له** — قِيس بالتجربة لا بالظنّ: قلبُ المصفوفة
 * > كلِّها يُبقي الطقمَ أخضرَ حرفياً (٤١٨٩/٤١٨٩)، لأنها تُقرأ **خريطةً بالاسم** (`BY_NAME`)
 * > وكلُّ عابرٍ عليها يبحث ولا يعتمد موضعاً. **أمّا ترتيبُ الأعمدة داخل الجدول فذو أثرٍ
 * > ومحروس** (`PRAGMA table_info` يُقارَن بـ`toEqual` — وقد تحقّقتُ بتبديل عمودين فسقط
 * > الاختبارُ باسمه). ولذلك **نُقلت الكتلُ نصّاً كما هي** ولم يُعَد ترتيبُ عمودٍ واحد.
 * >
 * > ولذلك أيضاً **لا يُثبَّت ترتيبُ الجداول بحارس**: تثبيتُ ما لا أثرَ له يُنشئ **قائمةً
 * > تُسرد** يُحرّرها كلُّ وحدةٍ تُنقل — وهو عينُ التعارض الذي جاء هذا التقسيمُ ليمنعه.
 */

import type { TableSpec } from "./schema/columns.js"
import { CUSTODY_TABLES } from "./schema/custody.js"
import { DAILY_LOG_TABLES } from "./schema/dailyLog.js"
import { INFRASTRUCTURE_TABLES } from "./schema/infrastructure.js"
import { LEDGER_TABLES } from "./schema/ledger.js"
import { LIBRARY_TABLES } from "./schema/library.js"
import { NOTIFICATIONS_TABLES } from "./schema/notifications.js"
import { ORG_TABLES } from "./schema/org.js"
import { SHARED_TABLES } from "./schema/shared.js"

export type { ColumnSpec, ColumnType, TableSpec } from "./schema/columns.js"
export { ROUTING_COLUMN, TENANT_COLUMN, TENANT_ROOT_PATH } from "./schema/columns.js"

/**
 * **نقطةُ التسجيل** — مدخلٌ واحدٌ لكلِّ وحدة. ناقلُ الوحدة يضيف سطرَ استيرادٍ أعلاه ومدخلاً
 * هنا، و**لا يلمس سطراً غيرهما** في هذا الملفّ.
 */
export const TABLES: readonly TableSpec[] = [
  ...INFRASTRUCTURE_TABLES,
  ...ORG_TABLES,
  ...LEDGER_TABLES,
  ...CUSTODY_TABLES,
  ...DAILY_LOG_TABLES,
  ...NOTIFICATIONS_TABLES,
  ...LIBRARY_TABLES,
  ...SHARED_TABLES,
]

const BY_NAME = new Map(TABLES.map((t) => [t.name, t]))

export function tableSpec(name: string): TableSpec {
  const spec = BY_NAME.get(name)
  if (spec === undefined) throw new Error(`جدولٌ بلا مخطط: ${name} — لا يُقذف ما لا مخططَ له`)
  return spec
}

export function hasTable(name: string): boolean {
  return BY_NAME.has(name)
}
