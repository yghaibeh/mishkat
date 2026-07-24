export interface AppBarProps {
  title: string;
  /** سطر النطاق أو السياق تحت العنوان */
  subtitle?: string;
  /** شارة الدور، مثل «أمير المسجد» */
  roleBadge?: string;
  /** عدد الإشعارات؛ يظهر جرس عند تمريره (والعدّاد عربي-هندي: مرّر "٣") */
  bellCount?: string | number | null;
  onBell?: () => void;
  /** أيقونة بداية (رجوع مثلاً: chevron-right في RTL) */
  leadingIcon?: string;
  onLeading?: () => void;
  elevated?: boolean;
  trailing?: React.ReactNode;
}
