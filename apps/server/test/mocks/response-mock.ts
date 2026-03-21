import { vi } from 'vitest';

export const mockResponse = () => {
  const response: any = {};
  response.send = vi.fn().mockReturnValue(response);
  response.sendStatus = vi.fn().mockReturnValue(response);
  response.status = vi.fn().mockReturnValue(response);
  response.cookie = vi.fn().mockReturnValue(response);
  response.clearCookie = vi.fn().mockReturnValue(response);
  return response;
};
