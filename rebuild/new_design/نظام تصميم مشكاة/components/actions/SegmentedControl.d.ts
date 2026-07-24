export interface SegmentedControlProps {
  /** تسميات الخيارات (٢–٤) */
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: React.CSSProperties;
}
