import { describe, expect, it } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { register } from './collection-activity-api';

describe('collection activity API', () => {
  it.each([{}, { year: '02026' }, { year: '2026.5' }, { year: ['2026'] }, { year: '2026', type: 'invalid' }])(
    'rejects invalid query %j',
    async (query) => {
      const response = mockResponse();
      const { app, handlerPromise } = buildApp({ usernameHash: 'user', query }, response);
      register(app);
      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
    }
  );
  it('returns an empty year summary', async () => {
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { year: '2026' } }, response);
    register(app);
    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2026, planned: 0, completed: 0, inProgress: 0 })
    );
  });
});
