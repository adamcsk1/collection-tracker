import { vi } from 'vitest';

export const mockResponse = () => {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.code = vi.fn().mockReturnValue(response);
  response.setCookie = vi.fn().mockReturnValue(response);
  response.clearCookie = vi.fn().mockReturnValue(response);
  response.header = vi.fn().mockReturnValue(response);
  return response;
};
