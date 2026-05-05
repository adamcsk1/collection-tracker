import { describe, expect, it, vi } from 'vitest';
import { withErrorHandler } from './api-error-handler';

describe('withErrorHandler', () => {
  it('calls the handler and returns normally on success', async () => {
    const handler = vi.fn().mockResolvedValue('ok');
    const request = { method: 'GET', originalUrl: '/test' } as any;
    const response = { sendStatus: vi.fn() } as any;

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(handler).toHaveBeenCalledWith(request, response);
    expect(response.sendStatus).not.toHaveBeenCalled();
  });

  it('logs error and sends 500 when handler throws', async () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at somewhere';
    const handler = vi.fn().mockRejectedValue(error);
    const request = { method: 'POST', originalUrl: '/api/items' } as any;
    const response = { sendStatus: vi.fn() } as any;

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });

  it('sends 500 for non-error throws', async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw 'string error';
    });
    const request = { method: 'GET', originalUrl: '/api/test' } as any;
    const response = { sendStatus: vi.fn() } as any;

    const wrapped = withErrorHandler(handler);
    await wrapped(request, response);

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
