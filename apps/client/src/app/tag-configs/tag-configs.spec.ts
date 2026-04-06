import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import { TagConfigsModel } from '@client/tag-configs/tag-configs-model';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagConfigs } from './tag-configs';
import { TagConfigsService } from './tag-configs-service';
import { initialTagConfigsState, TagConfigsState, tagConfigsStateToken } from './tag-configs-store';

const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
  rawContent: overrides.rawContent || '',
  rawContentLower: (overrides.rawContent || '').toLowerCase(),
  image: '',
  title: overrides.title || '',
  titleLower: (overrides.title || '').toLowerCase(),
  genre: [],
  IMDbId: overrides.IMDbId || 'tt0000001',
  tags: overrides.tags || [],
  name: overrides.name || 'Item',
  year: null,
  rate: '',
  hash: '',
});

const buildTagConfig = (tag: string, overrides: Partial<TagConfigsModel[number]>): TagConfigsModel[number] => ({
  tag,
  color: null,
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

describe('TagConfigs component', () => {
  let fixture: ComponentFixture<TagConfigs>;
  let component: TagConfigs;
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let tagConfigsState: NgxSimpleSignalStoreService<TagConfigsState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };
  let tagConfigsService: { syncUserTagConfigs: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    tagConfigsService = {
      syncUserTagConfigs: vi.fn((configs: TagConfigsModel) => {
        tagConfigsState.setState(
          'configs',
          [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        );
        return of(void 0);
      }),
    };

    TestBed.configureTestingModule({
      imports: [TagConfigs],
      providers: [
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: ConfirmService, useValue: confirm },
        { provide: TagConfigsService, useValue: tagConfigsService },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialTagConfigsState, tagConfigsStateToken),
      ],
    });

    fixture = TestBed.createComponent(TagConfigs);
    component = fixture.componentInstance;
    mainCollectionState = TestBed.inject(mainCollectionStateToken);
    tagConfigsState = TestBed.inject(tagConfigsStateToken);
    toastState = TestBed.inject(toastStateToken);

    fixture.detectChanges();
  });

  it('builds tag configurations from collection tags while ignoring internal/virtual tags', () => {
    mainCollectionState.setState('collection', [
      buildItem({
        tags: ['#a', '#b', '#series', '#movie', '#unwatched', '#a', '#tag-with-weight'],
      }),
    ]);

    tagConfigsState.setState('configs', [buildTagConfig('#tag-with-weight', { color: '#aabbcc', weight: 7 })]);
    fixture.detectChanges();

    expect(component['tagConfigs']()).toEqual([
      buildTagConfig('#a', {}),
      buildTagConfig('#b', {}),
      buildTagConfig('#tag-with-weight', { color: '#aabbcc', weight: 7 }),
    ]);
  });

  it('updates only one field and keeps existing values', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

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
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

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
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

    component['onUseForImageBorderChange']('#tag', true);

    expect(tagConfigsState.state.configs()).toEqual([
      buildTagConfig('#tag', {
        color: null,
        useForImageBorder: true,
      }),
    ]);
  });

  it('coerces text input into numeric weight and falls back to zero on invalid values', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

    component['onWeightChange']('#tag', 42);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 42 })]);

    component['onWeightChange']('#tag', Number.NaN);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 0 })]);
  });

  it('stores configs sorted by descending weight and syncs them via service', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#low', '#high'] })]);
    fixture.detectChanges();

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

  it('adds a new config with defaults when color changes for unknown tag', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#new'] })]);
    fixture.detectChanges();

    component['onTagColorChange']('#new', '#abc');

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#new', { color: '#abc' })]);
  });

  it('seeds a black color when the color picker is opened for an uncolored tag', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.tag-configs-item-color button') as HTMLButtonElement;
    button.click();

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { color: '#000000' })]);
  });

  it('does not overwrite an existing color when the color picker button is clicked', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456' })]);
    fixture.detectChanges();
    tagConfigsService.syncUserTagConfigs.mockClear();

    const button = fixture.nativeElement.querySelector('.tag-configs-item-color button') as HTMLButtonElement;
    button.click();

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { color: '#123456' })]);
    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
  });

  it('resets tag configs after confirmation and syncs empty list', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })]);
    fixture.detectChanges();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual([]);
    expect(tagConfigsService.syncUserTagConfigs).toHaveBeenLastCalledWith([]);
  });

  it('does not clear configs when reset is not confirmed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    const initialConfigs = [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })];
    tagConfigsState.setState('configs', initialConfigs);
    fixture.detectChanges();
    tagConfigsService.syncUserTagConfigs.mockClear();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual(initialConfigs);
    expect(tagConfigsService.syncUserTagConfigs).not.toHaveBeenCalled();
  });

  it('shows toast message when syncing tag configs fails', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();
    tagConfigsService.syncUserTagConfigs.mockReturnValueOnce(throwError(() => new Error('fail')));

    component['onTagColorChange']('#tag', '#123456');

    expect(toastState.state.message()).toBe('Toast.TagConfigSyncError');
  });
});
