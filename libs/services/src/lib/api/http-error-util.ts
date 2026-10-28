export const isTransientHttpError = (error: unknown): error is { status: number } =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number' &&
  (error.status === 0 || error.status === 429 || (error.status >= 500 && error.status <= 599));
