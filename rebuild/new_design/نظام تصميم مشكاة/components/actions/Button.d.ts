/** @startingPoint section="مكوّنات" subtitle="زر أساسي/ثانوي/شبحي بثلاثة مقاسات" viewport="700x260" */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  /** اسم أيقونة Lucide تسبق النص */
  icon?: string;
  /** يملأ عرض الحاوية */
  full?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
