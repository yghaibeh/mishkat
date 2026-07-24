export interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** نص مساعد تحت الحقل */
  helper?: string;
  /** رسالة خطأ — تلوّن الحد وتحلّ محل المساعد */
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  type?: string;
  style?: React.CSSProperties;
}
