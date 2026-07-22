/**
 * **بدائيّاتُ وصف المخطط** — الأنواعُ وبناةُ الأعمدة وثوابتُ مفتاح التوجيه.
 *
 * موطنُها هنا لا في `../schema.ts` **لسببٍ بنيويّ لا ترتيبيّ**: المُجمِّعُ يستورد ملفّات
 * الوحدات، وملفّاتُ الوحدات تحتاج هذه البدائيّات — فلو سكنت المُجمِّعَ لصارت الدائرةُ
 * `schema.ts ⟵ schema/org.ts ⟵ schema.ts`. **والدوائرُ في ESM تُقيَّم جزئياً**، فيصير
 * `text` غيرَ مُعرَّفٍ لحظةَ بناء المصفوفة — عطبٌ يظهر عند التحميل لا عند الترجمة.
 *
 * **ولا يُصدّر هذا الملفُّ مصفوفةَ جداول** — وبذلك يستبعده حارسُ التسجيل **بالاشتقاق**
 * (`tests/migrations/schema-partition.test.ts`) لا بسرد اسمه في استثناء (CR-011/قب-٣٦).
 */

export type ColumnType = "text" | "int"

export type ColumnSpec = {
  readonly name: string
  readonly type: ColumnType
  readonly nullable: boolean
}

export type TableSpec = {
  readonly name: string
  readonly columns: readonly ColumnSpec[]
  readonly primaryKey: readonly string[]
  /**
   * جدولٌ **لا يُمحى منه صفّ** (المادة ٧/٤): اختفاءُ صفٍّ من الإسقاط عطبٌ برمجيّ
   * يُرمى ولا يُترجم إلى `DELETE`.
   */
  readonly appendOnly: boolean
  /** بنيةٌ تحتية: بلا شبكةٍ وبلا مفتاح توجيه (دفترُ الهجرات وحده اليوم). */
  readonly infrastructure: boolean
}

export const TENANT_COLUMN = "tenant_id"
export const ROUTING_COLUMN = "unit_path"
/** نطاقُ ما ليس نطاقُه وحدةً: الشبكةُ كلُّها (وهو **صادقٌ** لا حشو — README الحسم ٢). */
export const TENANT_ROOT_PATH = "/"

export const text = (name: string, nullable = false): ColumnSpec => ({
  name,
  type: "text",
  nullable,
})
export const int = (name: string, nullable = false): ColumnSpec => ({
  name,
  type: "int",
  nullable,
})
/** العمودان الأولان في كلِّ جدولِ بياناتٍ — الترتيبُ مقصود: المفتاحُ يُقرأ أولاً. */
export const routing = (): readonly ColumnSpec[] => [text(TENANT_COLUMN), text(ROUTING_COLUMN)]
