export interface StepperFieldProps {
  label?: string;
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** وحدة صغيرة داخل العدّاد: "س" أو "د" أو "آية" */
  unit?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
