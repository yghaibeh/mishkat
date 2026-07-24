export interface ProgressCardProps {
  title: string;
  value: number;
  max: number;
  /** وحدة القياس عند variant="bar" */
  unit?: string;
  /** سطر «بقي …» */
  remaining?: string;
  /** سطر صغير أسفل */
  footnote?: string;
  variant?: 'ring' | 'bar';
  style?: React.CSSProperties;
}
