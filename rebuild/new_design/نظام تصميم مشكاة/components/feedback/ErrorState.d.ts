export interface ErrorStateProps {
  title?: string;
  /** رسالة إنسانية مطمئنة، بلا مصطلحات تقنية */
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}
