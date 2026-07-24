export interface TimelineStep {
  label: string;
  state: 'done' | 'current' | 'todo';
  /** تاريخ أو سياق صغير تحت التسمية */
  caption?: string;
}
export interface TimelineProps {
  steps: TimelineStep[];
  style?: React.CSSProperties;
}
