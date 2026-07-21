/**
 * قاموسُ نصوص العُهد — **داخل الوحدة** (قب-٣١ §٣: نصوصُ الوكيل في وحدته لا في ملفٍّ مشترك)،
 * ويُدمج في الطبقة المركزية الواحدة (`ui/text/dictionary.ts`) حيث يُفحص التصادمُ صراحةً.
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً** (SPEC_design_system §٥-٣، G20).
 *
 * **ولماذا هنا لا في `screens/`؟** لأنّ G20 تمنع الحرفَ العربيّ في **ما يُصيَّر** — ومجلدُ
 * `screens/` هو ما يُصيَّر. أمّا هذا فـ**كتالوجُ نصٍّ** نظيرُ `ui/text/domains.ts`: موضعُ
 * التدقيق اللغويّ لا موضعُ العرض. فالفصلُ التزامٌ بالقاعدة لا التفافٌ عليها — ولو وُضع في
 * `screens/` لَصار المصدرُ والمُصيَّرُ في سلّةٍ واحدة، وهو عينُ ما تمنعه §٥-٣.
 *
 * و**مفرداتُ الميدان لا مفرداتُ السجلّ**: «بيده · سلّمتُ · استلمتُ» — لا «قيدُ حيازة».
 */

export const CUSTODY = {
  "custody.heading": "عُهد نطاقي",
  "custody.scopeNote": "العُهد التي في نطاقك وحده",
  "custody.assetLabel": "الأصل",
  "custody.holder": "بيد",
  "custody.state": "الحال",
  "custody.serial": "الرقم التسلسلي",
  "custody.note": "ملاحظة",
  "custody.unitHome": "وحدةُ الأصل",
  "custody.condition": "حالُه عند الحركة",
  "custody.recipient": "المستلِم",
  "custody.action": "الحركة",
  "custody.register": "سجِّل أصلاً جديداً",
  "custody.amend": "عدِّل سجلَّ الأصل",
  "custody.move": "سجِّل حركةَ عهدة",
  "custody.chain": "سلسلةُ الحيازة",
  "custody.stateInUnit": "في الوحدة",
  "custody.statePending": "بانتظار إقرار المستلِم",
  "custody.stateHeld": "بيده وأقرّ",
  "custody.stateDamaged": "تالف",
  "custody.stateLost": "مفقود",
  "custody.stateRetired": "خارج الخدمة",
  "custody.mineHeading": "عُهدتي",
  "custody.mineScopeNote": "ما بيدك أنت وحدك",
  "custody.receive": "استلمتُ",
  "custody.receiveBody": "بإقرارك تصير العهدةُ بيدك موثّقةً بالطرفين",
  "custody.emptyOwner": "لا أصلَ في نطاقك بعد — سجِّل أوّلَ أصل",
  "custody.emptyScope": "لا عهدةَ في هذا النطاق بعد",
  "custody.emptyMine": "لا عهدةَ بيدك — وما يصلك يظهر هنا لتقرّه",
  "custody.holderNone": "لا أحد",
} as const
