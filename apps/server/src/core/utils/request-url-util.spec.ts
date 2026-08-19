import { describe, expect, it } from 'vitest';
import { getRequestPath } from './request-url-util';

describe('getRequestPath', () => {
  it('removes query parameters from request URLs', () => {
    expect(getRequestPath('/api/v1/collection-items?query=secret&type=movie')).toBe('/api/v1/collection-items');
  });

  it('keeps request paths without query parameters unchanged', () => {
    expect(getRequestPath('/api/v1/health')).toBe('/api/v1/health');
  });
});
