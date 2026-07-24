export interface StatusDotProps {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  /** القطر بالبكسل؛ الافتراضي ٨ */
  size?: number;
  style?: React.CSSProperties;
}
