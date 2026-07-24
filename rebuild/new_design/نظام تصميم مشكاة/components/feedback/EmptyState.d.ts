export interface EmptyStateProps {
  /** اسم أيقونة Lucide داخل قرص أخضر فاتح */
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}
