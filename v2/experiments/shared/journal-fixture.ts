/**
 * نقطةُ الدخول الواحدة إلى الشاشة الحاسمة — يستهلكها المرشّحان وخادماهما بلا تفرّع.
 * الدورُ `finance_officer` من **المصفوفة الذهبية** لا قائمةَ قدراتٍ ثانية هنا.
 */

import { ROLE_CAPABILITIES } from "../../src/authorization/generated/roles.generated.js"
import type { UiNode } from "../../src/ui/components/kernel.js"
import { journalScreenTree, MEASURED_CONTEXT, MEASURED_DRAFT } from "./journal-tree.js"
import type { JournalDraft } from "./journal-model.js"

export const JOURNAL_CAPS = ROLE_CAPABILITIES.finance_officer
export const JOURNAL_CTX = MEASURED_CONTEXT
export const JOURNAL_DRAFT = MEASURED_DRAFT

export function journalTree(draft: JournalDraft = MEASURED_DRAFT): UiNode {
  return journalScreenTree(JOURNAL_CAPS, draft, MEASURED_CONTEXT)
}

export const JOURNAL_TITLE_AR = "اقتراحُ قيدٍ محاسبيّ جديد — مشكاة"
