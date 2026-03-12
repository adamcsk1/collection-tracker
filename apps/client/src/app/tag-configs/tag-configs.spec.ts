import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { mainCollectionStateToken, initialMainCollectionState } from '@client/main/main-collection-store';
import { TagConfigsModel } from '@client/tag-configs/tag-configs-model';
import { TagConfigs } from './tag-configs';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { STORAGE_TAG_CONFIGS } from '@shared/constants/storage-const';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, of } from 'rxjs';
import { tagConfigsStateToken, initialTagConfigsState } from './tag-configs-store';

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
});

const buildTagConfig = (tag: string, overrides: Partial<TagConfigsModel[number]>): TagConfigsModel[number] => ({
  tag,
  color: 'transparent',
  useForImageBorder: false,
  useForTextColor: false,
  useForImageBadge: false,
  weight: 0,
  ...overrides,
});

describe('TagConfigs component', () => {
  let fixture: ComponentFixture<TagConfigs>;
  let component: TagConfigs;
  let mainCollectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;
  let tagConfigsState: NgxSimpleSignalStoreService<typeof initialTagConfigsState>;
  let webstorage: { setItem: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    webstorage = { setItem: vi.fn() };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      imports: [TagConfigs],
      providers: [
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: ConfirmService, useValue: confirm },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialTagConfigsState, tagConfigsStateToken),
      ],
    });

    fixture = TestBed.createComponent(TagConfigs);
    component = fixture.componentInstance;
    mainCollectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
    tagConfigsState = TestBed.inject(tagConfigsStateToken) as NgxSimpleSignalStoreService<
      typeof initialTagConfigsState
    >;

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

  it('coerces text input into numeric weight and falls back to zero on invalid values', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    fixture.detectChanges();

    component['onWeightChange']('#tag', 42);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 42 })]);

    component['onWeightChange']('#tag', Number.NaN);
    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#tag', { weight: 0 })]);
  });

  it('stores configs sorted by descending weight and writes them to local storage', () => {
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

    expect(webstorage.setItem).toHaveBeenLastCalledWith(
      STORAGE_TAG_CONFIGS,
      JSON.stringify([
        buildTagConfig('#high', { color: '#222222', weight: 9 }),
        buildTagConfig('#low', { color: '#111111', weight: 1 }),
      ])
    );
  });

  it('adds a new config with defaults when color changes for unknown tag', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#new'] })]);
    fixture.detectChanges();

    component['onTagColorChange']('#new', '#abc');

    expect(tagConfigsState.state.configs()).toEqual([buildTagConfig('#new', { color: '#abc' })]);
  });

  it('resets tag configs after confirmation and clears storage', () => {
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    tagConfigsState.setState('configs', [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })]);
    fixture.detectChanges();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual([]);
    expect(webstorage.setItem).toHaveBeenLastCalledWith(STORAGE_TAG_CONFIGS, JSON.stringify([]));
  });

  it('does not clear configs when reset is not confirmed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    mainCollectionState.setState('collection', [buildItem({ tags: ['#tag'] })]);
    const initialConfigs = [buildTagConfig('#tag', { color: '#123456', useForImageBorder: true })];
    tagConfigsState.setState('configs', initialConfigs);
    fixture.detectChanges();
    webstorage.setItem.mockClear();

    component['onResetTagConfigs']();

    expect(tagConfigsState.state.configs()).toEqual(initialConfigs);
    expect(webstorage.setItem).not.toHaveBeenCalled();
  });
});
