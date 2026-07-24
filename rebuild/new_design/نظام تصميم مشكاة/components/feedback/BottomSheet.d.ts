export interface BottomSheetProps {
  open: boolean;
  title?: string;
  /** نص أو محتوى التأكيد */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** فعل مدمّر — يلوّن زر التأكيد أحمر */
  danger?: boolean;
  /** true = Modal مكتبي متوسّط بدل لوح سفلي */
  center?: boolean;
}
