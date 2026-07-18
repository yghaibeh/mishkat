import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// كشفٌ عند التمرير — يضيف صنف is-in عند ظهور العنصر (يحترم prefers-reduced-motion عبر CSS).
export function Reveal({ children, className, delay, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: 1 | 2 | 3; as?: "div" | "section" | "li" | "article" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={cn("reveal", delay === 1 && "reveal-d1", delay === 2 && "reveal-d2", delay === 3 && "reveal-d3", shown && "is-in", className)}>
      {children}
    </Tag>
  );
}
