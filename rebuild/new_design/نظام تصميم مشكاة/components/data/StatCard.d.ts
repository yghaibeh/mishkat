export interface StatCardProps {
  /** الرقم الكبير، عربي-هندي: "٣١٢" */
  value: string;
  /** لاحقة بجانب الرقم: "من ٤٠٠" */
  suffix?: string;
  label: string;
  /** سطر سياق صغير */
  context?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'flat';
  onClick?: () => void;
  style?: React.CSSProperties;
}
