export interface ToastProps {
  message: string;
  tone?: 'success' | 'danger' | 'neutral';
  /** فعل نصي مثل «تراجع» */
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}
