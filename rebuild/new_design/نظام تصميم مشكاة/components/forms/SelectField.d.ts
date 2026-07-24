export interface SelectFieldProps {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
