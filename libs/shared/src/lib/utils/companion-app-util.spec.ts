import { describe, expect, it, vi } from 'vitest';
import { companionApp, resetCompanionAppConfig, saveCompanionAppDownload } from './companion-app-util';

describe('companionApp', () => {
  it('returns true when CollectionTrackerInterface exists on window', () => {
    window.CollectionTrackerInterface = {};
    expect(companionApp()).toBe(true);
  });

  it('returns false when CollectionTrackerInterface does not exist', () => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    expect(companionApp()).toBe(false);
  });
});

describe('resetCompanionAppConfig', () => {
  it('calls resetAppConfig on the bridge when available', () => {
    const resetAppConfig = vi.fn(() => true);
    window.CollectionTrackerInterface = { resetAppConfig };

    const result = resetCompanionAppConfig();

    expect(resetAppConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('returns undefined when interface is missing', () => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    expect(resetCompanionAppConfig()).toBeUndefined();
  });
});

describe('saveCompanionAppDownload', () => {
  it('calls saveDownload on the bridge with base64 encoded content', () => {
    const saveDownload = vi.fn(() => true);
    window.CollectionTrackerInterface = { saveDownload };

    const result = saveCompanionAppDownload('export.json', 'application/json', '{"tag":"#ä"}');

    expect(saveDownload).toHaveBeenCalledWith('export.json', 'application/json', 'eyJ0YWciOiIjw6QifQ==');
    expect(result).toBe(true);
  });

  it('returns false when saveDownload is missing', () => {
    window.CollectionTrackerInterface = {};
    expect(saveCompanionAppDownload('export.json', 'application/json', '{}')).toBe(false);
  });
});
