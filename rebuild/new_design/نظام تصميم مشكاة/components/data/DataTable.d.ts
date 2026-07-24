export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
}
export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, React.ReactNode>[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  /** تخصيص عرض خلية */
  renderCell?: (row: any, key: string) => React.ReactNode;
  rowKey?: (row: any) => string;
  style?: React.CSSProperties;
}
