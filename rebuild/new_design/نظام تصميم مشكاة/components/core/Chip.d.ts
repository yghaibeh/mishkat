export interface ChipProps {
  /** الحالة تحدد اللون والتسمية الافتراضية: معتمد / معلّق / متأخر */
  status?: 'approved' | 'pending' | 'late' | 'neutral';
  /** تسمية بديلة عن الافتراضية */
  label?: string;
  withDot?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
