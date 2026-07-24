export interface AttendanceSwitchProps {
  /** null = لم يُسجَّل بعد */
  value?: 'present' | 'absent' | null;
  onChange?: (value: 'present' | 'absent' | null) => void;
  disabled?: boolean;
  /** أيقونات فقط بلا تسميات (لصفوف مزدحمة) */
  compact?: boolean;
}
