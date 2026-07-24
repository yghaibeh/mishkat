export interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** تسميات الفلاتر الحبّية */
  filters?: string[];
  activeFilters?: string[];
  onToggleFilter?: (filter: string) => void;
  style?: React.CSSProperties;
}
