export interface TabOption<TValue extends string = string> {
  value: TValue;
  label: string;
  dataTestId: string;
  disabled?: boolean;
}
