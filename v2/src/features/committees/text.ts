/**
 * قاموسُ وحدة اللجان والاجتماعات — `SPEC_design_system` §٥-٢: «نصوصُ كل مجالٍ في موضعها،
 * لا مِلفٌّ عملاق». يُدمَج في طبقة النصوص المركزية (`ui/text/dictionary.ts`) فيُدقَّق كلُّ
 * حرفٍ يراه المستخدم في **مكانٍ واحد** (المادة ٢/٦)، ويبقى **مصدرُه داخل وحدته**.
 *
 * **ومفرداتُ كل دورٍ من عدسته** (`SPEC_role_lenses`): مسؤولُ اللجنة يقرأ «لجنتي · خطتنا ·
 * أنشطتنا · إقرار الأمير» (§٢.٧)، والأميرُ يقرأ «لجان مسجدي · اجتماعات المسجد» (§٢.٥).
 */

export const COMMITTEES = {
  // ── لجانُ المسجد (عدسةُ الأمير ومَن فوقه — §٢.٥ بابُه ٤) ────────────────────
  "committees.heading": "لجان مسجدي",
  "committees.scopeNote": "اللجان على مسجدك وما تحته",
  "committees.formAction": "تشكيلُ لجنة",
  "committees.stopAction": "إيقافُ لجنة",
  "committees.nameLabel": "اسمُ اللجنة",
  "committees.headLabel": "مسؤولُ اللجنة",
  "committees.headHint": "اسمٌ نصّيٌّ يكفي — والحساب يُمكَّن عند الحاجة من الإدارة",
  "committees.activeCount": "لجانٌ عاملةٌ في مسجدك",
  "committees.emptyOwner": "لم تُشكَّل لجنةٌ بعد — ابدأ بتشكيل لجنةٍ وتسميةِ مسؤولها",
  "committees.emptyViewer": "المسجدُ لم يشكّل لجانَه بعد، وأميرُه المسؤول ويُسأل",

  // ── لجنتي (عدسةُ مسؤول اللجنة — §٢.٧) ──────────────────────────────────────
  "myCommittee.heading": "لجنتي",
  "myCommittee.scopeNote": "الأرقام على لجنتك وحدها",
  "myCommittee.membersHeading": "الشبابُ المشاركون معنا",
  "myCommittee.memberNameLabel": "اسمُ المشارك",
  "myCommittee.addMemberAction": "إضافةُ مشارك",
  "myCommittee.activitiesHeading": "أنشطتنا",
  "myCommittee.activityTitleLabel": "النشاط",
  "myCommittee.participantCountLabel": "عددُ الشباب المشاركين",
  "myCommittee.completedAtLabel": "تاريخُ الإنجاز",
  "myCommittee.recordActivityAction": "تسجيلُ نشاط",
  "myCommittee.pendingAmir": "مسوّدةٌ تنتظر إقرار الأمير",
  "myCommittee.countedNote": "لا تُحتسب نقاطُ النشاط لسجل المسجد إلا بعد إقرار الأمير",
  "myCommittee.emptyOwner": "لم تُسجَّل أنشطةٌ بعد — ابدأ بتسجيل نشاطٍ منجَز",
  "myCommittee.emptyMembers": "لم يُضَف مشاركٌ بعد",
  "myCommittee.emptyViewer": "لجنتُك وحدَها تظهر هنا",

  // ── اجتماعاتُ المسجد: محضرٌ وقرارات (ب-١٨؛ ب-٢ مدفون) ──────────────────────
  "meetings.heading": "اجتماعاتُ المسجد",
  "meetings.scopeNote": "المحاضرُ على مسجدك وما تحته",
  "meetings.recordAction": "تسجيلُ محضر",
  "meetings.minutesLabel": "المحضر",
  "meetings.decisionsLabel": "القرارات",
  "meetings.heldAtLabel": "تاريخُ الاجتماع",
  "meetings.decisionsCount": "قراراتٌ صدرت في مسجدك",
  "meetings.emptyOwner": "لم يُسجَّل محضرٌ بعد — سجّل محضرَ اجتماعك وقراراته",
  "meetings.emptyViewer": "المسجدُ لم يسجّل محاضرَه بعد، وأميرُه المسؤول ويُسأل",
} as const
