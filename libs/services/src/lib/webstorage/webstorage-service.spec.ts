import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { WebstorageService } from './webstorage-service';

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe('WebstorageService', () => {
  let service: WebstorageService;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: createMemoryStorage(), configurable: true });

    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [WebstorageService],
    });

    service = TestBed.inject(WebstorageService);
  });

  it('reads and writes to the chosen storage', () => {
    service.setItem('token', 'local-token');
    service.setItem('session-token', 'session-value', 'session');

    expect(localStorage.getItem('token')).toBe('local-token');
    expect(sessionStorage.getItem('session-token')).toBe('session-value');
    expect(service.getItem('token')).toBe('local-token');
    expect(service.getItem('session-token', 'session')).toBe('session-value');
  });

  it('prefers sessionStorage when storage type is not provided', () => {
    sessionStorage.setItem('pref', 'session-first');
    localStorage.setItem('pref', 'local-second');

    expect(service.getItem('pref')).toBe('session-first');
  });

  it('removes and clears items in the requested storages', () => {
    sessionStorage.setItem('cleanup', 'session');
    localStorage.setItem('cleanup', 'local');

    service.removeItem('cleanup');
    expect(sessionStorage.getItem('cleanup')).toBeNull();
    expect(localStorage.getItem('cleanup')).toBeNull();

    sessionStorage.setItem('only-session', '1');
    localStorage.setItem('only-local', '2');

    service.clear('session');
    expect(sessionStorage.getItem('only-session')).toBeNull();
    expect(localStorage.getItem('only-local')).toBe('2');

    service.clear();
    expect(localStorage.getItem('only-local')).toBeNull();
  });

  it('supports explicit storage selection for get/remove/clear', () => {
    localStorage.setItem('local-key', 'l');
    sessionStorage.setItem('session-key', 's');

    expect(service.getItem('local-key', 'local')).toBe('l');

    service.removeItem('session-key', 'session');
    expect(sessionStorage.getItem('session-key')).toBeNull();
    expect(localStorage.getItem('local-key')).toBe('l');

    service.clear('local');
    expect(localStorage.getItem('local-key')).toBeNull();
  });

  it('removes only from session storage when requested', () => {
    sessionStorage.setItem('session-only', 'value');
    localStorage.setItem('session-only', 'persist');

    const sessionRemoveSpy = vi.spyOn(sessionStorage, 'removeItem');

    service.removeItem('session-only', 'session');

    expect(sessionRemoveSpy).toHaveBeenCalledWith('session-only');
    expect(localStorage.getItem('session-only')).toBe('persist');
  });
});
