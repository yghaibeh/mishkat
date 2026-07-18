import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

// «/» = الصفحة التعريفية للزوّار فقط — المسجَّلُ يُحال لرئيسيته (٣٦ §١.٦: لا هبوطَ تسويقيًّا لمن دخل).
export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: { caps: string[] } }).user;
    if (user) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "مِشكاة — منظومة إدارة المسجد المؤثر" },
      { name: "description", content: "منصّة متكاملة لإدارة شبكة المساجد المؤثرة: سجل يومي، اعتماد شوري طبقي، مالية وحلقات ومسابقة — بالتقويم الهجري." },
    ],
  }),
  component: LandingPage,
});
