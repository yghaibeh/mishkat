export interface BottomNavItem {
  id: string;
  /** اسم أيقونة Lucide */
  icon: string;
  label: string;
  /** نقطة تنبيه حمراء */
  badge?: boolean;
}
export interface BottomNavProps {
  /** ٥–٦ وجهات */
  items: BottomNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}
