export interface SidebarItem {
  id?: string;
  icon?: string;
  label?: string;
  /** عدّاد صغير (عربي-هندي) */
  count?: string;
  /** عنصر عنوان قسم بدل رابط */
  section?: string;
}
export interface SidebarProps {
  items: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}
