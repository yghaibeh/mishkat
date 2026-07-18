import { cn } from "@/lib/utils";

// لبنة تحميل موحّدة بلغة مشكاة — تمنع وميض القيم الفارغة قبل وصول البيانات.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}

// هيكل صفحة عام أثناء تحميل المسار (pendingComponent) — ترويسة + شبكة مؤشّرات + قائمة.
function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-12" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-32" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="mt-3 h-9 w-20" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-2xl bg-surface p-5 ring-1 ring-line">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  );
}

export { Skeleton, PageSkeleton };
