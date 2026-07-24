export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** يولّد Avatar تلقائياً من الاسم */
  avatarName?: string;
  avatarTone?: 'green' | 'gold' | 'neutral';
  /** بديل عن الـ Avatar (أيقونة داخل قرص مثلاً) */
  leading?: React.ReactNode;
  /** عادة <Chip status=…/> */
  status?: React.ReactNode;
  trailing?: React.ReactNode;
  /** سهم تفصيل (chevron-left في RTL) */
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
