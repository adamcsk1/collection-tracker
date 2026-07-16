export const isRateLimitError = (error: unknown): error is { status: number } =>
  typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
