export interface AvatarProps {
  /** الاسم الكامل؛ تُشتق منه الأحرف (أول الاسم الأول + أول الأخير) */
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'green' | 'gold' | 'neutral';
  /** صورة حقيقية إن وُجدت */
  src?: string;
  style?: React.CSSProperties;
}
