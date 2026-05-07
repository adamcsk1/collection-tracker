import { describe, expect, it, vi } from 'vitest';
import { withErrorHandler } from './api-error-handler';

describe('withErrorHandler', () => {
  const mockResponse = () => {
    const response: any = {};
    response.send = vi.fn().mockReturnValue(response);
    response.code = vi.fn().mockReturnValue(response);
    return response;
  };

  it('calls the handler and returns normally on success', async () => {
    const handler = vi.fn().mockResolvedValue('ok');
    const request = { method: 'GET', url: '/test' } as any;
    const response = mockResponse();

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(handler).toHaveBeenCalledWith(request, response);
    expect(response.code).not.toHaveBeenCalled();
  });

  it('logs error and sends 500 when handler throws', async () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at somewhere';
    const handler = vi.fn().mockRejectedValue(error);
    const request = { method: 'POST', url: '/api/items' } as any;
    const response = mockResponse();

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(response.code).toHaveBeenCalledWith(500);
  });

  it('sends 500 for non-error throws', async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw 'string error';
    });
    const request = { method: 'GET', url: '/api/test' } as any;
    const response = mockResponse();

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(response.code).toHaveBeenCalledWith(500);
  });
});
