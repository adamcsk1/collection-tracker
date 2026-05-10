import { getBasePath } from './get-base-path-util';

export const getLoginUrl = (): string => `${getBasePath()}/login/`;

export const redirectToLogin = () => {
  try {
    window.location.assign(getLoginUrl());
  } catch {}
};
