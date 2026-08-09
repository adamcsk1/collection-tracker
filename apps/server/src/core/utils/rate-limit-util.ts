const getRateLimit = (name: 'AUTH_RATE_LIMIT' | 'REFRESH_RATE_LIMIT', defaultLimit: number): number => {
  const configuredLimit = Number(process.env[name]);
  return Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : defaultLimit;
};

export const getAuthRateLimit = (): number => getRateLimit('AUTH_RATE_LIMIT', 10);

export const getRefreshRateLimit = (): number => getRateLimit('REFRESH_RATE_LIMIT', 60);
