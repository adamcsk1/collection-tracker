import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAG_MANAGEMENT_EXPORT_TYPE, TAG_MANAGEMENT_EXPORT_VERSION } from '../tag-management/tag-management-const';
import { TagManagementModel } from '../tag-management/tag-management-model';
import { ExportImportService } from './export-import-service';

const buildTagManagement = (
  tag: string,
  overrides: Partial<TagManagementModel[number]> = {}
): TagManagementModel[number] => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

describe('ExportImportService', () => {
  let service: ExportImportService;
  let documentRef: Document;

  beforeEach(() => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:export') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

    TestBed.configureTestingModule({ providers: [ExportImportService] });
    service = TestBed.inject(ExportImportService);
    documentRef = TestBed.inject(DOCUMENT);
  });

  it('saves a download through the browser fallback', () => {
    const anchor = documentRef.createElement('a');
    anchor.click = vi.fn();
    vi.spyOn(documentRef, 'createElement').mockReturnValue(anchor);

    service.saveDownload('tags.json', 'application/json', '{"ok":true}');

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.href).toBe('blob:export');
    expect(anchor.download).toBe('tags.json');
    expect(anchor.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('parses valid tag management exports', () => {
    const tagManagement = [buildTagManagement('#movie', { color: '#123456', weight: 2 })];

    const result = service.parseImportedTagManagement(
      JSON.stringify({ type: TAG_MANAGEMENT_EXPORT_TYPE, version: TAG_MANAGEMENT_EXPORT_VERSION, tagManagement })
    );

    expect(result).toEqual(tagManagement);
  });

  it('rejects invalid tag management exports', () => {
    expect(service.parseImportedTagManagement('{bad json')).toBeNull();
    expect(
      service.parseImportedTagManagement(JSON.stringify({ type: 'wrong', version: 1, tagManagement: [] }))
    ).toBeNull();
    expect(
      service.parseImportedTagManagement(
        JSON.stringify({
          type: TAG_MANAGEMENT_EXPORT_TYPE,
          version: TAG_MANAGEMENT_EXPORT_VERSION,
          tagManagement: [{ tag: '#movie', color: '#123456' }],
        })
      )
    ).toBeNull();
  });

  it('merges tag management configs without overwriting conflicts', () => {
    const existingConfig = buildTagManagement('#existing', { color: '#111111' });
    const importedConflict = buildTagManagement('#existing', { color: '#222222' });
    const importedNew = buildTagManagement('#new', { color: '#333333' });

    expect(service.mergeTagManagementConfigs([existingConfig], [importedConflict, importedNew], false)).toEqual([
      existingConfig,
      importedNew,
    ]);
  });

  it('merges tag management configs with conflict overwrites', () => {
    const existingConfig = buildTagManagement('#existing', { color: '#111111' });
    const importedConflict = buildTagManagement('#existing', { color: '#222222' });
    const importedNew = buildTagManagement('#new', { color: '#333333' });

    expect(service.mergeTagManagementConfigs([existingConfig], [importedConflict, importedNew], true)).toEqual([
      importedConflict,
      importedNew,
    ]);
  });
});
