/**
 * المرشّح (ب) — الجزيرةُ الوحيدة على العميل: ربطُ الأزرار بطابور الأوفلاين.
 * لا ترطيبَ لشجرةٍ ولا نسخةٌ ثانيةٌ من الحالة: الخادمُ صيَّر، والجزيرةُ تُضيف السلوك فقط.
 */

import { wireOutboxButtons } from "../shared/outbox.js"

wireOutboxButtons(document)
performance.mark("mishkat-hydrated")
