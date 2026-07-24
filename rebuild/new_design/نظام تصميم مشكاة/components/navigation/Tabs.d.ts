export interface TabItem {
  id: string;
  label: string;
  /** عدّاد عربي-هندي */
  count?: string;
  disabled?: boolean;
}
export interface TabsProps {
  tabs: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}
