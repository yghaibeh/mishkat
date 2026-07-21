/**
 * معجمُ الشاشات — نقطةُ التسجيل الواحدة (IA §الحوكمة، ق-١١٣).
 *
 * استيرادُ هذا الملفّ يسجّل **كلَّ** شاشات النظام بعقودها؛ وG20 تقرأ السجلّ فتحاكمها جميعاً.
 * شاشةٌ لا تصل من هنا **غيرُ موجودة** بحكم البوابة — نظيرُ «الدالة بلا إعلانٍ لا تُسجَّل» (G7).
 */

import "./features/org/screens/screens.js"
import "./features/home/screens/screens.js"
import "./features/ledger/screens/screens.js"

export { registeredScreens } from "./ui/screens/registry.js"
