import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

// «/» = الصفحة التعريفية العامة (Hero). الدخول عبر زرٍّ يحيل إلى /login؛ والمسجّل يرى زرّ «لوحتي».
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مِشكاة — منظومة إدارة المسجد المؤثر" },
      { name: "description", content: "منصّة متكاملة لإدارة شبكة المساجد المؤثرة: سجل يومي، اعتماد شوري طبقي، مالية وحلقات ومسابقة — بالتقويم الهجري." },
    ],
  }),
  component: LandingPage,
});
