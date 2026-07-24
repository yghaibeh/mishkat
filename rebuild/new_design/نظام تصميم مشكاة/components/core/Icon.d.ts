export interface IconProps {
  /** اسم أيقونة Lucide، مثل "bell" أو "chevron-left" */
  name: string;
  size?: number;
  /** لون CSS؛ الافتراضي currentColor */
  color?: string;
  style?: React.CSSProperties;
}
