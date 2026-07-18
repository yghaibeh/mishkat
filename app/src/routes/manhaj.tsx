import { createFileRoute } from "@tanstack/react-router";
import { ManhajPage } from "@/components/manhaj/ManhajPage";

// «/manhaj» = قارئ منهاج «على بصيرة» — صفحة عامة (بلا تسجيل دخول).
export const Route = createFileRoute("/manhaj")({
  validateSearch: (s: Record<string, unknown>): { lesson?: string } => ({ lesson: typeof s.lesson === "string" ? s.lesson : undefined }),
  head: () => ({
    meta: [
      { title: "منهاج على بصيرة — مِشكاة" },
      { name: "description", content: "قارئ منهاج «على بصيرة» التربوي للشباب والأسرة — وحدات ودروس غنية بالآيات والأحاديث والفوائد." },
    ],
  }),
  component: ManhajPage,
});
