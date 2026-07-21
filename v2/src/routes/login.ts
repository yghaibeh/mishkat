/**
 * صفحة الدخول — الصفحة العامة الوحيدة.
 * طبقة عرض: لا تقرر صلاحية ولا تفحص دوراً (المادة ٤/٦) — تعرض ما يعطيها الخادم.
 */
export type LoginView = {
  readonly title: string
  readonly fields: readonly { readonly name: string; readonly labelAr: string }[]
  readonly submitLabelAr: string
}

export function loginView(): LoginView {
  return {
    title: "الدخول إلى مِشكاة",
    fields: [
      { name: "username", labelAr: "اسم المستخدم" },
      { name: "password", labelAr: "كلمة المرور" },
    ],
    submitLabelAr: "دخول",
  }
}
