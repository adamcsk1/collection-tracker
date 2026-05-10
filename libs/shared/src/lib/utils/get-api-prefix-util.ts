import { getBasePath } from './get-base-path-util';

export const getApiPrefix = (): string => {
  const basePath = getBasePath();
  return `${basePath}/api/v1`;
};
