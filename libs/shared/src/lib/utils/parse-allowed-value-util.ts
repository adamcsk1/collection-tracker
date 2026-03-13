export const isAllowedValue = <T extends string>(value: string, allowed: ReadonlyArray<T>): value is T =>
  allowed.some((item) => item === value);

export const parseAllowedValue = <T extends string>(value: string | null, allowed: ReadonlyArray<T>): T | null => {
  if (value === null) return null;
  return isAllowedValue(value, allowed) ? value : null;
};
