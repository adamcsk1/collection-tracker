import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { TagConfigsModel } from './tag-configs-model';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagConfigs } from './tag-configs';
import { TagConfigsService } from './tag-configs-service';
import { initialTagConfigsState, TagConfigsState, tagConfigsStateToken } from './tag-configs-store';

const buildTagConfig = (tag: string, overrides: Partial<TagConfigsModel[number]>): TagConfigsModel[number] => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

const mockStatistics = (tags: string[]) =>
  of({
    totalItems: tags.length,
    movieCount: 0,
    seriesCount: 0,
    favoriteCount: 0,
    watchLaterCount: 0,
    wishlistCount: 0,
    watchedCount: 0,
    unwatchedCount: 0,
    tagCounts: tags.map((tag) => ({ tag, count: 1 })),
    genreCounts: [],
  });

describe('TagConfigs component', () => {
  let fixture: ComponentFixture<TagConfigs>;
  let component: TagConfigs;
  let tagConfigsState: NgxSimpleSignalStoreService<TagConfigsState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let tagConfigsService: { syncUserTagConfigs: ReturnType<typeof vi.fn> };
  let api: { getStatistics: ReturnType<typeof vi.fn> };

  const createComponent = (tags: string[] = []) => {
    api.getStatistics.mockReturnValue(mockStatistics(tags));
    fixture = TestBed.createComponent(TagConfigs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:tag-configs') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    HTMLAnchorElement.prototype.click = vi.fn();
    confirm = { ifConfirmed: vi.fn(() => of(true)), open: vi.fn(() => of(true)) };
    tagConfigsService = {
      syncUserTagConfigs: vi.fn((configs: TagConfigsModel) => {
        tagConfigsState.setState(
          'configs',
          [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        );
        return of(void 0);
      }),
    };
    api = { getStatistics: vi.fn(() => mockStatistics([])) };

    TestBed.configureTestingModule({
      imports: [TagConfigs],
      providers: [
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: ConfirmService, useValue: confirm },
        { provide: TagConfigsService, useValue: tagConfigsService },
        { provide: ApiService, useValue: api },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialTagConfigsState, tagConfigsStateToken),
      ],
    });

    tagConfigsState = TestBed.inject(tagConfigsStateToken);
    toastState = TestBed.inject(toastStateToken);
  });

  it('builds tag configurations from collection tags while ignoring internal/virtual tags', () => {
    createComponent(['#a', '#b', '#series', '#movie', '#unwatched', '#a', '#tag-with-weight']);

    tagConfigsState.setState('configs', [buildTagConfig('#tag-with-weight', { color: '#aabbcc', weight: 7 })]);
    fixture.detectChanges();

    expect(component['tagConfigs']()).toEqual([
      buildTagConfig('#a', {}),
      buildTagConfig('#b', {}),
      buildTagConfig('#tag-with-weight', { color: '#aabbcc', weight: 7 }),
    ]);
  });

  it('updates only one field and keeps existing values', () => {
    createComponent(['#tag']);

    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456', weight: 5 })]);
    fixture.detectChanges();

    component['onUseForImageBorderChange']('#tag', true);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#tag', {
        color: '#123456',
        weight: 5,
        useForImageBorder: true,
      }),
    ]);

    component['onUseForTextColorChange']('#tag', true);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#tag', {
        color: '#123456',
        weight: 5,
        useForImageBorder: true,
        useForTextColor: true,
      }),
    ]);
  });

  it('updates only image badge flag and keeps existing values', () => {
    createComponent(['#tag']);

    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456', useForTextColor: true })]);
    fixture.detectChanges();

    component['onUseForImageBadgeChange']('#tag', true);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#tag', {
        color: '#123456',
        useForTextColor: true,
        useForImageBadge: true,
      }),
    ]);
  });

  it('keeps color as null when creating a new config from a non-color change', () => {
    createComponent(['#tag']);

    component['onUseForImageBorderChange']('#tag', true);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#tag', {
        color: null,
        useForImageBorder: true,
      }),
    ]);
  });

  it('coerces text input into numeric weight and falls back to zero on invalid values', () => {
    createComponent(['#tag']);

    component['onWeightChange']('#tag', 42);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 42 })]);

    component['onWeightChange']('#tag', Number.NaN);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 0 })]);
  });

  it('stores configs sorted by descending weight and syncs them via service', () => {
    createComponent(['#low', '#high']);

    component['onTagColorChange']('#low', '#111111');
    component['onTagColorChange']('#high', '#222222');
    component['onWeightChange']('#low', 1 as unknown as number);
    component['onWeightChange']('#high', 9 as unknown as number);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#high', { color: '#222222', weight: 9 }),
      buildTagConfig('#low', { color: '#111111', weight: 1 }),
    ]);

    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenLastCalledWith([
      buildTagConfig('#low', { color: '#111111', weight: 1 }),
      buildTagConfig('#high', { color: '#222222', weight: 9 }),
    ]);
  });

  it('shows success toast after syncing tag configs', () => {
    createComponent(['#tag']);
    toastState.setState('message', '');

    component['onTagColorChange']('#tag', '#123456');

    expect(toastState.state.message()).toBe('Toast.TagConfigSaved');
  });

  it('does not show success toast while pruning stale configs on load', () => {
    tagConfigsState.setState('configs', [buildTagConfig('#stale', { color: '#123456' })]);

    createComponent(['#tag']);

    expect(toastState.state.message()).toBe('');
  });

  it('does not clear stored configs when collection tags load before tag configs preload', () => {
    createComponent(['#tag']);

    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
  });

  it('adds a new config with defaults when color changes for unknown tag', () => {
    createComponent(['#new']);

    component['onTagColorChange']('#new', '#abc');

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#new', { color: '#abc' })]);
  });

  it('seeds a black color when the color picker is opened for an uncolored tag', () => {
    createComponent(['#tag']);

    const button = fixture.nativeElement.querySelector('[data-test-id="tag-config-color-#tag"]') as HTMLButtonElement;
    button.click();

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { color: '#000000' })]);
  });

  it('does not overwrite an existing color when the color picker button is clicked', () => {
    createComponent(['#tag']);
    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456' })]);
    fixture.detectChanges();
    tagConfigsService.syncUserTagConfigs.mockClear();

    const button = fixture.nativeElement.querySelector('[data-test-id="tag-config-color-#tag"]') as HTMLButtonElement;
    button.click();

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { color: '#123456' })]);
    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
  });

  it('filters tag configs by substring match case-insensitively', () => {
    createComponent(['#alpha', '#beta', '#gamma']);

    component['onFilterChange']('alp');

    expect(component['tagConfigs']()).toEqual([buildTagConfig('#alpha', {})]);
  });

  it('shows all tag configs when filter is empty', () => {
    createComponent(['#alpha', '#beta']);

    component['onFilterChange']('');

    expect(component['tagConfigs']()).toEqual([buildTagConfig('#beta', {}), buildTagConfig('#alpha', {})]);
  });

  it('trims filter text before matching', () => {
    createComponent(['#alpha']);

    component['onFilterChange']('  alpha  ');

    expect(component['tagConfigs']()).toEqual([buildTagConfig('#alpha', {})]);
  });

  it('resets tag configs after confirmation and syncs empty list', () => {
    createComponent(['#tag']);
    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })]);
    fixture.detectChanges();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual([]);
    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenLastCalledWith([]);
  });

  it('exports the full stored tag config JSON', async () => {
    createComponent(['#visible']);
    tagConfigsState.setState('configs', [
      buildTagConfig('#visible', { color: '#123456' }),
      buildTagConfig('#stale', { color: '#abcdef', useForImageBadge: true }),
    ]);

    component['onExportTagConfigs']();

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    await expect(blob.text().then((source) => JSON.parse(source))).resolves.toEqual({
      type: 'collection-tracker-tag-configs',
      version: 1,
      tagConfigs: [
        buildTagConfig('#visible', { color: '#123456' }),
        buildTagConfig('#stale', { color: '#abcdef', useForImageBadge: true }),
      ],
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tag-configs');
    expect(toastState.state.message()).toBe('Toast.TagConfigExported');
  });

  it('imports new tag configs without overwriting existing configs', () => {
    createComponent(['#existing', '#new']);
    const existingConfig = buildTagConfig('#existing', { color: '#111111' });
    const newConfig = buildTagConfig('#new', { color: '#222222', useForImageBorder: true });
    tagConfigsState.setState('configs', [existingConfig]);
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['importTagConfigs'](
      JSON.stringify({ type: 'collection-tracker-tag-configs', version: 1, tagConfigs: [newConfig] })
    );

    expect(confirm.open).not.toHaveBeenCalled();
    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenCalledWith([existingConfig, newConfig]);
    expect(toastState.state.message()).toBe('Toast.TagConfigImported');
  });

  it('skips conflicting imported configs when conflict overwrite is cancelled', () => {
    confirm.open.mockReturnValueOnce(of(false));
    createComponent(['#existing', '#new']);
    const existingConfig = buildTagConfig('#existing', { color: '#111111' });
    const importedExistingConfig = buildTagConfig('#existing', { color: '#999999', useForImageBorder: true });
    const newConfig = buildTagConfig('#new', { color: '#222222' });
    tagConfigsState.setState('configs', [existingConfig]);
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['importTagConfigs'](
      JSON.stringify({
        type: 'collection-tracker-tag-configs',
        version: 1,
        tagConfigs: [importedExistingConfig, newConfig],
      })
    );

    expect(confirm.open).toHaveBeenCalledWith('Confirm.ImportTagConfigConflicts');
    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenCalledWith([existingConfig, newConfig]);
  });

  it('overwrites conflicting imported configs when conflict overwrite is confirmed', () => {
    confirm.open.mockReturnValueOnce(of(true));
    createComponent(['#existing', '#new']);
    const existingConfig = buildTagConfig('#existing', { color: '#111111' });
    const importedExistingConfig = buildTagConfig('#existing', { color: '#999999', useForImageBorder: true });
    const newConfig = buildTagConfig('#new', { color: '#222222' });
    tagConfigsState.setState('configs', [existingConfig]);
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['importTagConfigs'](
      JSON.stringify({
        type: 'collection-tracker-tag-configs',
        version: 1,
        tagConfigs: [importedExistingConfig, newConfig],
      })
    );

    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenCalledWith([importedExistingConfig, newConfig]);
  });

  it('shows import error toast for invalid import JSON', () => {
    createComponent(['#tag']);
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['importTagConfigs']('{bad json');

    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.TagConfigImportError');
  });

  it('shows import error toast for invalid import config shape', () => {
    createComponent(['#tag']);
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['importTagConfigs'](
      JSON.stringify({
        type: 'collection-tracker-tag-configs',
        version: 1,
        tagConfigs: [{ tag: '#tag', color: null, useForImageBorder: true }],
      })
    );

    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.TagConfigImportError');
  });

  it('does not clear configs when reset is not confirmed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    createComponent(['#tag']);
    const initialConfigs = [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })];
    tagConfigsState.setState('configs', initialConfigs);
    fixture.detectChanges();
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual(initialConfigs);
    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
  });

  it('shows toast message when syncing tag configs fails', () => {
    createComponent(['#tag']);
    tagConfigsService.syncUserTagConfigs.mockReturnValueOnce(throwError(() => new Error('fail')));

    component['onTagColorChange']('#tag', '#123456');

    expect(toastState.state.message()).toBe('Toast.TagConfigSyncError');
  });
});
