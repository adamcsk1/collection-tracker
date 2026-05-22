import { API_PREFIX } from '@shared/constants/api-const';

export const RATE_LIMIT_EXCLUDED_PATHS: string[] = [
  `${API_PREFIX}/proxy/image`,
  `${API_PREFIX}/health`,
  `${API_PREFIX}/sign-in`,
  `${API_PREFIX}/sign-up`,
  `${API_PREFIX}/session/refresh`,
];
