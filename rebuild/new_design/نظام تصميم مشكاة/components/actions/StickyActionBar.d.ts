export interface StickyActionBarProps {
  /** نص الزر الرئيس */
  label?: string;
  /** سطر سياق صغير فوق الزر */
  hint?: string;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  /** بديل كامل عن الزر الافتراضي (مثلاً زرّان) */
  children?: React.ReactNode;
}
