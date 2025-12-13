import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');

describe('health-api', () => {
  it('responds with Ok', async () => {
    const response = mockResponse();
    const { app$ } = buildApp({}, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);

    await import('./health-api');

    expect(response.send).toHaveBeenCalledWith({ message: 'Ok' });
  });
});
