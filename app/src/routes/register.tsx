import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/auth/RegisterPage";

// صفحة التسجيل الذاتيّ — عامّة (بلا جلسة). ?status=<token> تعرض حالة الطلب.
export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "الانضمام — مشكاة" },
      { name: "description", content: "سجّل طلب انضمامك إلى منظومة مشكاة وتعتمده الجهة المشرفة." },
    ],
  }),
  component: RegisterPage,
});
