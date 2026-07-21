/**
 * جدولُ الغياب — SPEC_role_lenses §٣ («لبّ علاج v1»).
 *
 * لكل دورٍ: ما **يجب ألّا يظهر** له صراحةً، بالخلايا `·` الحارسة من المصفوفة الذهبية.
 * هذا الجدولُ يُغذّي G20 في اتجاهين: يؤكّد أن **المصفوفةَ نفسَها** لا تمنح المحظور (فلا
 * تتباعد المواصفةُ عن الملفّ الذهبيّ)، وأن **لا شاشةً** تُظهره. وهو تحديداً ما كان مكسوراً
 * في v1: دورٌ يرى ما ليس له.
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import type { RoleId } from "../../authorization/generated/roles.generated.js"

export const ABSENCE_BY_ROLE: Readonly<Partial<Record<RoleId, readonly CapId[]>>> = Object.freeze({
  // المدير: اطّلاعٌ وحوكمةٌ لا تشغيل (ق-٣/ق-٤ «المدير لا يُكلَّف»).
  admin: [
    "report.approve",
    "report.submit",
    "visit.conduct",
    "dailyLog.edit",
    "media.post",
    "box.receive",
    "box.spend",
    "box.handover",
    "custody.own",
    "circle.manage",
  ],
  // مشرف القسم: لا تشغيلَ مسجدٍ مفرد ولا محاسبةً مركزية ولا نشرَ تغطية.
  section_head: ["circle.manage", "dailyLog.edit", "finance.entry", "ledger.journal.entry", "media.post"],
  // المنطقة: كما القسم + لا إدارةَ موادّ ولا تصديرَ ماليّ (§٣.٣).
  rabita: ["library.manage", "finance.export", "finance.entry", "circle.manage", "media.post"],
  // المربع: توفيرٌ بلا تعديلٍ ولا إنشاءِ وحدات، ولا تدخّلَ فوقياً ولا تعديلَ مقفل (ق-م٢).
  square: [
    "user.manage",
    "account.status.manage",
    "account.password.reset",
    "orgUnit.manage",
    "report.approve.override",
    "records.editLocked",
    "finance.approve",
    "circle.manage",
    "audit.view",
  ],
  // الأمير: **لا «بيان» شبكيّ** (لا يملك #١) ولا تعديلَ تكاليف.
  amir: ["network.view", "user.manage", "report.approve.override", "records.editLocked", "audit.view"],
  // المعلّم: عزلُ ملكية — لا كتابةَ ملاحظات إشراف ولا إدارةَ حلقاتٍ أخرى ولا إدارةَ نظام.
  teacher: ["circle.notes.supervise", "circle.manage", "admin.view", "network.view", "audit.view"],
  committee_head: ["committees.manage", "report.approve", "network.view", "circle.manage"],
  media: ["competition.manage", "visit.conduct", "report.approve", "network.view"],
  // الماليّ: **إعدادٌ لا اعتماد** (البتّ بـ`finance.supervise` عند المدير) ولا تشغيلَ شبكة.
  finance_officer: [
    "finance.approve",
    "finance.supervise",
    "report.approve",
    "visit.approve",
    "box.receive",
    "box.spend",
  ],
  // الطالب: أربعةُ أبوابٍ شخصية لا غير.
  student: [
    "network.view",
    "report.view",
    "circle.view",
    "duties.manage",
    "media.hub",
    "box.view",
    "admin.view",
  ],
})
