/**
 * ق-٦٤ — **فئاتُ الصرف قاموسٌ مغلقٌ مركزيّ من البيانات لا من الكود** (عقدُ الوحدة §٢.٢).
 *
 * «مغلق» تعني: الفئةُ المجهولة تُرفض. ولا تعني أن تعيش القائمةُ في الكود — لو عاشت فيه
 * لصارت إضافةُ فئةٍ نشرَ نسخة، وهو عينُ ما يمنعه قب-٦ (الإعدادات الحيّة) وتحرسه G14.
 * فالقاموسُ **بياناتٌ مرجعية** تديرها الإدارة، والكودُ يسأل عنها ولا يحملها.
 */

import type { BoxStore } from "../data/store.js"
import { boxErr, boxOk, type BoxResult, type SpendCategory } from "../types.js"

/** الفئاتُ المعروضةُ للاختيار: **الفعّالةُ وحدها** — والموقوفةُ تبقى في البيانات ولا تُحذف. */
export function spendCategories(store: BoxStore): readonly SpendCategory[] {
  return store.categories().filter((c) => c.active)
}

/**
 * حارسُ القاموس: مجهولةٌ ⇒ `UNKNOWN_CATEGORY` · موقوفةٌ ⇒ `CATEGORY_INACTIVE`.
 * **سببان لا سببٌ واحد**: «لا أعرفها» غيرُ «أعرفها وأُوقفت» — والفرقُ يصل المستخدمَ فيُصحِّح.
 */
export function resolveSpendCategory(store: BoxStore, categoryId: string): BoxResult<SpendCategory> {
  const category = store.getCategory(categoryId)
  if (category === null) return boxErr("UNKNOWN_CATEGORY", categoryId)
  if (!category.active) return boxErr("CATEGORY_INACTIVE", categoryId)
  return boxOk(category)
}
