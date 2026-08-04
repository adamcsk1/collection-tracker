import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { TagManagementModel } from '../tag-management/tag-management-model';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportImport } from './export-import';
import { SettingsService } from '../settings-service';
import { TagManagementService } from '../tag-management/tag-management-service';
import {
  initialTagManagementState,
  TagManagementState,
  tagManagementStateToken,
} from '../../tag-management/tag-management-store';
import { UserExportApiResponseModel } from '@shared/models/api-model';

const buildTagManagement = (
  tag: string,
  overrides: Partial<TagManagementModel[number]>
): TagManagementModel[number] => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

const mockExportResponse: UserExportApiResponseModel = {
  type: 'collection-tracker-export',
  version: 6,
  userSettings: { theme: 'dark' },
  collectionItems: [
    {
      image: 'img.jpg',
      title: 'Movie',
      titleLower: 'movie',
      genre: ['Action'],
      IMDbId: 'tt123',
      externalProvider: 'omdb',
      externalItemId: 'tt123',
      tags: ['#movie'],
      year: '2020',
      rate: '8.0',
      rottenTomatoesRate: '90',
      metacriticRate: '85',
      userRate: 9.0,
      hash: 'hash1',
      actors: 'Actor',
      plot: 'Plot',
      listType: 'library',
      contentType: 'movie',
      favorite: false,
      watchedAt: null,
    },
    {
      image: 'img2.jpg',
      title: 'Tracker Movie',
      titleLower: 'tracker movie',
      genre: ['Drama'],
      IMDbId: 'tt124',
      externalProvider: 'omdb',
      externalItemId: 'tt124',
      tags: ['#movie'],
      year: '2021',
      rate: '9.0',
      rottenTomatoesRate: '95',
      metacriticRate: '90',
      userRate: 10.0,
      hash: 'hash2',
      actors: 'Actor',
      plot: 'Plot',
      listType: 'finished',
      contentType: 'movie',
      favorite: false,
      watchedAt: null,
    },
  ],
  tagManagement: [buildTagManagement('#movie', { color: '#111111' })],
  trackingData: {},
};

describe('ExportImport component', () => {
  let fixture: ComponentFixture<ExportImport>;
  let component: ExportImport;
  let tagManagementState: NgxSimpleSignalStoreService<TagManagementState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let tagManagementService: {
    preloadUserTagManagement: ReturnType<typeof vi.fn>;
    syncUserTagManagement: ReturnType<typeof vi.fn>;
  };
  let settingsService: { preloadUserSettings: ReturnType<typeof vi.fn> };
  let api: {
    getUserExport: ReturnType<typeof vi.fn>;
    importUserExport: ReturnType<typeof vi.fn>;
    importCollectionItems: ReturnType<typeof vi.fn>;
  };
  let confirm: { open: ReturnType<typeof vi.fn> };

  const createComponent = () => {
    fixture = TestBed.createComponent(ExportImport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    delete (window as { CollectionTrackerInterface?: unknown }).CollectionTrackerInterface;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:export') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    HTMLAnchorElement.prototype.click = vi.fn();
    tagManagementService = {
      preloadUserTagManagement: vi.fn(() => of(void 0)),
      syncUserTagManagement: vi.fn((configs: TagManagementModel) => {
        tagManagementState.setState(
          'configs',
          [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        );
        return of(void 0);
      }),
    };
    settingsService = { preloadUserSettings: vi.fn(() => of(void 0)) };
    api = {
      getUserExport: vi.fn(() => of(mockExportResponse)),
      importUserExport: vi.fn(() =>
        of({
          importedCollectionItems: 2,
          importedTagManagement: 1,
          importedTrackingSeasons: 0,
          importedTrackingCompletedEpisodes: 0,
        })
      ),
      importCollectionItems: vi.fn(() => of({ totalCount: 2, importedCount: 1, skippedCount: 1, errorCount: 0 })),
    };
    confirm = { open: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [ExportImport],
      providers: [
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: TagManagementService, useValue: tagManagementService },
        { provide: SettingsService, useValue: settingsService },
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialTagManagementState, tagManagementStateToken),
      ],
    });

    tagManagementState = TestBed.inject(tagManagementStateToken);
    toastState = TestBed.inject(toastStateToken);
  });

  it('exports collection data JSON', async () => {
    createComponent();
    component['onExportCollectionData']();

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    await expect(blob.text().then((source) => JSON.parse(source))).resolves.toEqual(mockExportResponse);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(toastState.state.message()).toBe('');
  });

  it('exports collection data through the companion app bridge when available', () => {
    const saveDownload = vi.fn(() => true);
    window.CollectionTrackerInterface = { saveDownload };
    createComponent();

    component['onExportCollectionData']();

    expect(saveDownload).toHaveBeenCalledWith('collection-tracker-export.json', 'application/json', expect.any(String));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('shows export error toast when API fails', () => {
    api.getUserExport.mockReturnValueOnce(throwError(() => new Error('fail')));
    createComponent();

    component['onExportCollectionData']();

    expect(toastState.state.message()).toBe('Toast.ExportError');
  });

  it('imports collection data after confirmation', () => {
    confirm.open.mockReturnValueOnce(of(true));
    createComponent();
    const source = JSON.stringify(mockExportResponse);

    component['importCollectionData'](source);

    expect(confirm.open).toHaveBeenCalledWith('Confirm.ImportCollectionData');
    expect(api.importUserExport).toHaveBeenCalledWith(mockExportResponse);
    expect(settingsService.preloadUserSettings).toHaveBeenCalled();
    expect(tagManagementService.preloadUserTagManagement).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.CollectionDataImported');
  });

  it('does not import collection data when confirmation is cancelled', () => {
    confirm.open.mockReturnValueOnce(of(false));
    createComponent();

    component['importCollectionData'](JSON.stringify(mockExportResponse));

    expect(api.importUserExport).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('shows collection data import error toast for invalid JSON', () => {
    createComponent();

    component['importCollectionData']('{bad json');

    expect(api.importUserExport).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.CollectionDataImportError');
  });

  it('shows collection data import error toast when API fails', () => {
    confirm.open.mockReturnValueOnce(of(true));
    api.importUserExport.mockReturnValueOnce(throwError(() => new Error('fail')));
    createComponent();

    component['importCollectionData'](JSON.stringify(mockExportResponse));

    expect(toastState.state.message()).toBe('Toast.CollectionDataImportError');
  });

  it('imports collection items by IMDb ID source text', () => {
    createComponent();

    component['importCollectionItems']('tt0133093 tt0372784');

    expect(api.importCollectionItems).toHaveBeenCalledWith('tt0133093 tt0372784');
    expect(toastState.state.message()).toBe('Toast.CollectionItemsByIMDbIdImported');
  });

  it('shows collection items import error toast when API fails', () => {
    api.importCollectionItems.mockReturnValueOnce(throwError(() => new Error('fail')));
    createComponent();

    component['importCollectionItems']('tt0133093');

    expect(toastState.state.message()).toBe('Toast.CollectionItemsByIMDbIdImportError');
  });

  it('exports tag management JSON', async () => {
    createComponent();
    tagManagementState.setState('configs', [buildTagManagement('#movie', { color: '#123456' })]);

    component['onExportTagManagement']();

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    await expect(blob.text().then((source) => JSON.parse(source))).resolves.toEqual({
      type: 'collection-tracker-tag-management',
      version: 1,
      tagManagement: [buildTagManagement('#movie', { color: '#123456' })],
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(toastState.state.message()).toBe('');
  });

  it('imports new tag management without overwriting existing configs', () => {
    createComponent();
    const existingConfig = buildTagManagement('#existing', { color: '#111111' });
    const newConfig = buildTagManagement('#new', { color: '#222222', useForImageBorder: true });
    tagManagementState.setState('configs', [existingConfig]);
    tagManagementService.syncUserTagManagement.mockClear();

    component['importTagManagement'](
      JSON.stringify({ type: 'collection-tracker-tag-management', version: 1, tagManagement: [newConfig] })
    );

    expect(tagManagementService.syncUserTagManagement).toHaveBeenCalledWith([existingConfig, newConfig]);
    expect(toastState.state.message()).toBe('Toast.TagManagementImported');
  });

  it('shows import error toast for invalid import JSON', () => {
    createComponent();
    tagManagementService.syncUserTagManagement.mockClear();

    component['importTagManagement']('{bad json');

    expect(tagManagementService.syncUserTagManagement).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.TagManagementImportError');
  });

  it('overwrites conflicting imported configs when conflict overwrite is confirmed', () => {
    confirm.open.mockReturnValueOnce(of(true));
    createComponent();
    const existingConfig = buildTagManagement('#existing', { color: '#111111' });
    const importedExistingConfig = buildTagManagement('#existing', { color: '#999999', useForImageBorder: true });
    const newConfig = buildTagManagement('#new', { color: '#222222' });
    tagManagementState.setState('configs', [existingConfig]);
    tagManagementService.syncUserTagManagement.mockClear();

    component['importTagManagement'](
      JSON.stringify({
        type: 'collection-tracker-tag-management',
        version: 1,
        tagManagement: [importedExistingConfig, newConfig],
      })
    );

    expect(confirm.open).toHaveBeenCalledWith('Confirm.ImportTagManagementConflicts');
    expect(tagManagementService.syncUserTagManagement).toHaveBeenCalledWith([importedExistingConfig, newConfig]);
    expect(toastState.state.message()).toBe('Toast.TagManagementImported');
  });

  it('skips conflicting imported configs when conflict overwrite is cancelled', () => {
    confirm.open.mockReturnValueOnce(of(false));
    createComponent();
    const existingConfig = buildTagManagement('#existing', { color: '#111111' });
    const importedExistingConfig = buildTagManagement('#existing', { color: '#999999', useForImageBorder: true });
    const newConfig = buildTagManagement('#new', { color: '#222222' });
    tagManagementState.setState('configs', [existingConfig]);
    tagManagementService.syncUserTagManagement.mockClear();

    component['importTagManagement'](
      JSON.stringify({
        type: 'collection-tracker-tag-management',
        version: 1,
        tagManagement: [importedExistingConfig, newConfig],
      })
    );

    expect(confirm.open).toHaveBeenCalledWith('Confirm.ImportTagManagementConflicts');
    expect(tagManagementService.syncUserTagManagement).toHaveBeenCalledWith([existingConfig, newConfig]);
    expect(toastState.state.message()).toBe('Toast.TagManagementImported');
  });
});
