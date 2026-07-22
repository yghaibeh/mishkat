/**
 * قاموسُ نصوص «على بصيرة» — **داخل الوحدة** (قب-٣١ §٣-أ: النصوصُ في وحدتها، والتسجيلُ سطرٌ
 * واحدٌ في الطبقة المركزية حيث يُفحص التصادمُ صراحةً).
 *
 * **المكوّنُ يستقبل مفتاحاً لا حرفاً** (SPEC_design_system §٥-٣، G20)، و`screens/` هو ما
 * يُصيَّر — فالنصُّ هنا **كتالوجُ تدقيقٍ لغويّ** لا موضعُ عرض.
 *
 * و**مفرداتُ الميدان لا مفرداتُ النظام**: «الدرس · المجلس · المنهاج · الحضور · تقدّمُ المنهج».
 * **ولا اسمَ منهاجٍ بعينه هنا ولا اسمَ نوعِ حلقة**: أسماؤها **بياناتٌ** تأتي من المستودع
 * (قب-٢٢) — فلا مفتاحَ نصٍّ لمنهاجٍ بذاته إطلاقاً.
 */

export const EDUCATION = {
  "education.heading": "دروسُ الحلقة",
  "education.scopeNote": "دروسُ هذه الحلقة وحدها",
  "education.lessonsSentence": "دروسٌ سُجِّلت على هذه الحلقة",
  "education.session": "المجلس",
  "education.heldAt": "تاريخُ الدرس",
  "education.duration": "مدّةُ الدرس بالدقائق",
  "education.venue": "مكانُ الانعقاد",
  "education.present": "الحاضرون",
  "education.roster": "الملتحقون",
  "education.photos": "الصور",
  "education.state": "حالُ الاعتماد",
  "education.record": "سجِّل درساً",
  "education.students": "طلابُ الحلقة",
  "education.progressHeading": "تقدّمُ المنهج",
  "education.progressSentence": "مجالسُ أُكملت من مجموع المصفوفة",
  "education.progressScopeNote": "على هذه الحلقة وحدها",
  "education.progressCompleted": "المجالسُ المكتملة",
  "education.progressTotal": "مجالسُ المنهاج",
  "education.student": "الطالب",
  "education.correct": "صحِّح خليّةَ تقدّم",
  "education.correctionReason": "سببُ التصحيح",
  "education.completed": "أُكمل المجلس",
  "education.mineHeading": "دروسي",
  "education.mineSentence": "دروسٌ سجّلتَها على حلقاتك",
  "education.mineScopeNote": "ما أُسنِد إليك أنت وحدك",
  "education.manhajHeading": "المنهاج",
  "education.manhajSentence": "مناهجُ الشبكة المرجعية",
  "education.manhajScopeNote": "بياناتٌ مرجعيةٌ مركزية",
  "education.manhajKind": "نوعُ البند",
  "education.manhajId": "المعرّف",
  "education.manhajName": "الاسم",
  "education.manhajParent": "البندُ الأعلى",
  "education.manhajOrdinal": "الترتيب",
  "education.manhajCircleType": "نوعُ الحلقة",
  "education.manhajUpsert": "أضِف بنداً للمنهاج",
  "education.emptyOwner": "لا درسَ على هذه الحلقة بعد — سجِّل أوّلَ درسٍ من مجالس منهاجها",
  "education.emptyViewer": "لا درسَ سُجِّل على هذه الحلقة بعد",
  "education.emptyMine": "لا درسَ سجّلتَه بعد — وما تسجّله يظهر هنا",
  "education.emptyManhaj": "لا منهاجَ مسجَّلٌ بعد — أضِف أوّلَ منهاجٍ وبنوده",
  "education.emptyProgress": "لا مجلسَ في منهاج هذه الحلقة بعد",
} as const
