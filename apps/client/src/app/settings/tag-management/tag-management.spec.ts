import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { TagManagementModel } from './tag-management-model';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagManagement } from './tag-management';
import { TagManagementService } from './tag-management-service';
import {
  initialTagManagementState,
  tagManagementStateToken,
  type TagManagementState,
} from '../../tag-management/tag-management-store';

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

const mockStatistics = (tags: string[]) =>
  of({
    scope: 'all' as const,
    summary: { total: tags.length, movies: 0, series: 0, books: 0, favorites: 0 },
    charts: {
      tagCounts: tags.map((tag) => ({ tag, count: 1 })),
      genreCounts: [],
      releaseYearCounts: [],
      userRatingCounts: [],
      mediaTypeCounts: [],
      statusCounts: [],
    },
  });

describe('TagManagement component', () => {
  let fixture: ComponentFixture<TagManagement>;
  let component: TagManagement;
  let tagManagementState: NgxSimpleSignalStoreService<TagManagementState>;
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let tagManagementService: { syncUserTagManagement: ReturnType<typeof vi.fn>; renameTag: ReturnType<typeof vi.fn> };
  let api: { getStatistics: ReturnType<typeof vi.fn> };

  const createComponent = (tags: string[] = []) => {
    api.getStatistics.mockReturnValue(mockStatistics(tags));
    fixture = TestBed.createComponent(TagManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    confirm = { ifConfirmed: vi.fn(() => of(true)), open: vi.fn(() => of(true)) };
    tagManagementService = {
      syncUserTagManagement: vi.fn((configs: TagManagementModel) => {
        tagManagementState.setState(
          'configs',
          [...configs].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        );
        return of(void 0);
      }),
      renameTag: vi.fn(() => of({ renamedItemCount: 1, tagManagement: [] })),
    };
    api = { getStatistics: vi.fn(() => mockStatistics([])) };

    TestBed.configureTestingModule({
      imports: [TagManagement],
      providers: [
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: ConfirmService, useValue: confirm },
        { provide: TagManagementService, useValue: tagManagementService },
        { provide: ApiService, useValue: api },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
        provideStore(initialTagManagementState, tagManagementStateToken),
      ],
    });

    tagManagementState = TestBed.inject(tagManagementStateToken);
    toastState = TestBed.inject(toastStateToken);
  });

  it('renders tag management guidance as an article callout', () => {
    createComponent();
    const callout = fixture.nativeElement.querySelector('[data-test-id="tag-management-info"]');

    expect(callout.querySelector('aside').getAttribute('role')).toBe('note');
    expect(callout.querySelector('.material-icons').textContent.trim()).toBe('article');
    expect(callout.textContent).toContain('Message.TagManagement');
  });

  it('builds tag management entries from collection tags including former internal and virtual tags', () => {
    createComponent(['#a', '#b', '#series', '#movie', '#unwatched', '#a', '#tag-with-weight']);

    tagManagementState.setState('configs', [buildTagManagement('#tag-with-weight', { color: '#aabbcc', weight: 7 })]);
    fixture.detectChanges();

    expect(component['tagManagement']()).toEqual([
      buildTagManagement('#a', {}),
      buildTagManagement('#b', {}),
      buildTagManagement('#movie', {}),
      buildTagManagement('#series', {}),
      buildTagManagement('#unwatched', {}),
      buildTagManagement('#tag-with-weight', { color: '#aabbcc', weight: 7 }),
    ]);
  });

  it('updates only one field and keeps existing values', () => {
    createComponent(['#tag']);

    tagManagementState.setState('configs', [buildTagManagement('#tag', { color: '#123456', weight: 5 })]);
    fixture.detectChanges();

    component['onUseForImageBorderChange']('#tag', true);

    expect(tagManagementState.state.configs()).toEqual([
      buildTagManagement('#tag', {
        color: '#123456',
        weight: 5,
        useForImageBorder: true,
      }),
    ]);

    component['onUseForTextColorChange']('#tag', true);

    expect(tagManagementState.state.configs()).toEqual([
      buildTagManagement('#tag', {
        color: '#123456',
        weight: 5,
        useForImageBorder: true,
        useForTextColor: true,
      }),
    ]);
  });

  it('updates only image badge flag and keeps existing values', () => {
    createComponent(['#tag']);

    tagManagementState.setState('configs', [buildTagManagement('#tag', { color: '#123456', useForTextColor: true })]);
    fixture.detectChanges();

    component['onUseForImageBadgeChange']('#tag', true);

    expect(tagManagementState.state.configs()).toEqual([
      buildTagManagement('#tag', {
        color: '#123456',
        useForTextColor: true,
        useForImageBadge: true,
      }),
    ]);
  });

  it('keeps color as null when creating a new config from a non-color change', () => {
    createComponent(['#tag']);

    component['onUseForImageBorderChange']('#tag', true);

    expect(tagManagementState.state.configs()).toEqual([
      buildTagManagement('#tag', {
        color: null,
        useForImageBorder: true,
      }),
    ]);
  });

  it('coerces text input into numeric weight and falls back to zero on invalid values', () => {
    createComponent(['#tag']);

    component['onWeightChange']('#tag', 42);
    expect(tagManagementState.state.configs()).toEqual([buildTagManagement('#tag', { weight: 42 })]);

    component['onWeightChange']('#tag', Number.NaN);
    expect(tagManagementState.state.configs()).toEqual([buildTagManagement('#tag', { weight: 0 })]);
  });

  it('stores configs sorted by descending weight and syncs them via service', () => {
    createComponent(['#low', '#high']);

    component['onTagColorChange']('#low', '#111111');
    component['onTagColorChange']('#high', '#222222');
    component['onWeightChange']('#low', 1 as unknown as number);
    component['onWeightChange']('#high', 9 as unknown as number);

    expect(tagManagementState.state.configs()).toEqual([
      buildTagManagement('#high', { color: '#222222', weight: 9 }),
      buildTagManagement('#low', { color: '#111111', weight: 1 }),
    ]);

    expect(tagManagementService.syncUserTagManagement).toHaveBeenLastCalledWith([
      buildTagManagement('#low', { color: '#111111', weight: 1 }),
      buildTagManagement('#high', { color: '#222222', weight: 9 }),
    ]);
  });

  it('shows success toast after syncing tag management', () => {
    createComponent(['#tag']);
    toastState.setState('message', '');

    component['onTagColorChange']('#tag', '#123456');

    expect(toastState.state.message()).toBe('Toast.TagManagementSaved');
  });

  it('does not show success toast while pruning stale configs on load', () => {
    tagManagementState.setState('configs', [buildTagManagement('#stale', { color: '#123456' })]);

    createComponent(['#tag']);

    expect(toastState.state.message()).toBe('');
  });

  it('does not clear stored configs when collection tags load before tag management preload', () => {
    createComponent(['#tag']);

    expect(tagManagementService.syncUserTagManagement).not.toHaveBeenCalled();
  });

  it('does not resync stored configs when collection tags already match them', () => {
    tagManagementState.setState('configs', [buildTagManagement('#tag', { color: '#123456' })]);

    createComponent(['#tag']);

    expect(tagManagementService.syncUserTagManagement).not.toHaveBeenCalled();
  });

  it('adds a new config with defaults when color changes for unknown tag', () => {
    createComponent(['#new']);

    component['onTagColorChange']('#new', '#abc');

    expect(tagManagementState.state.configs()).toEqual([buildTagManagement('#new', { color: '#abc' })]);
  });

  it('seeds a black color when the color picker is opened for an uncolored tag', () => {
    createComponent(['#tag']);

    const button = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-color-#tag"]'
    ) as HTMLButtonElement;
    button.click();

    expect(tagManagementState.state.configs()).toEqual([buildTagManagement('#tag', { color: '#000000' })]);
  });

  it('does not overwrite an existing color when the color picker button is clicked', () => {
    createComponent(['#tag']);
    tagManagementState.setState('configs', [buildTagManagement('#tag', { color: '#123456' })]);
    fixture.detectChanges();
    tagManagementService.syncUserTagManagement.mockClear();

    const button = fixture.nativeElement.querySelector(
      '[data-test-id="tag-management-color-#tag"]'
    ) as HTMLButtonElement;
    button.click();

    expect(tagManagementState.state.configs()).toEqual([buildTagManagement('#tag', { color: '#123456' })]);
    expect(tagManagementService.syncUserTagManagement).not.toHaveBeenCalled();
  });

  it('filters tag management by substring match case-insensitively', () => {
    createComponent(['#alpha', '#beta', '#gamma']);

    component['onFilterChange']('alp');

    expect(component['tagManagement']()).toEqual([buildTagManagement('#alpha', {})]);
  });

  it('shows all tag management when filter is empty', () => {
    createComponent(['#alpha', '#beta']);

    component['onFilterChange']('');

    expect(component['tagManagement']()).toEqual([buildTagManagement('#beta', {}), buildTagManagement('#alpha', {})]);
  });

  it('trims filter text before matching', () => {
    createComponent(['#alpha']);

    component['onFilterChange']('  alpha  ');

    expect(component['tagManagement']()).toEqual([buildTagManagement('#alpha', {})]);
  });

  it('resets tag management after confirmation and syncs empty list', () => {
    createComponent(['#tag']);
    tagManagementState.setState('configs', [buildTagManagement('#tag', { color: '#123456', useForImageBorder: true })]);
    fixture.detectChanges();

    component['onResetTagManagement']();

    expect(tagManagementState.state.configs()).toEqual([]);
    expect(tagManagementService.syncUserTagManagement).toHaveBeenLastCalledWith([]);
  });

  it('does not clear configs when reset is not confirmed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    createComponent(['#tag']);
    const initialConfigs = [buildTagManagement('#tag', { color: '#123456', useForImageBorder: true })];
    tagManagementState.setState('configs', initialConfigs);
    fixture.detectChanges();
    tagManagementService.syncUserTagManagement.mockClear();

    component['onResetTagManagement']();

    expect(tagManagementState.state.configs()).toEqual(initialConfigs);
    expect(tagManagementService.syncUserTagManagement).not.toHaveBeenCalled();
  });

  it('shows toast message when syncing tag management fails', () => {
    createComponent(['#tag']);
    tagManagementService.syncUserTagManagement.mockReturnValueOnce(throwError(() => new Error('fail')));

    component['onTagColorChange']('#tag', '#123456');

    expect(toastState.state.message()).toBe('Toast.TagManagementSyncError');
  });

  it('renames a tag after confirmation and updates the list', () => {
    createComponent(['#old']);
    toastState.setState('message', '');
    api.getStatistics.mockReturnValue(mockStatistics(['#new']));

    component['onRenameTag']('#old', '  #new  ');

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RenameTag');
    expect(tagManagementService.renameTag).toHaveBeenCalledWith('#old', '#new');
    expect(component['tagManagement']()).toEqual([buildTagManagement('#new', {})]);
    expect(toastState.state.message()).toBe('Toast.TagRenamed');
  });

  it('adds a leading hash before renaming when the new tag omits it', () => {
    createComponent(['#old']);

    component['onRenameTag']('#old', 'new');

    expect(confirm.ifConfirmed).toHaveBeenCalledWith('Confirm.RenameTag');
    expect(tagManagementService.renameTag).toHaveBeenCalledWith('#old', '#new');
  });

  it('merges the displayed tag list when renaming to an existing tag', () => {
    createComponent(['#old', '#new']);
    api.getStatistics.mockReturnValue(mockStatistics(['#new']));

    component['onRenameTag']('#old', '#new');

    expect(component['tagManagement']()).toEqual([buildTagManagement('#new', {})]);
  });

  it('keeps shared visible tags when owned tags are renamed', () => {
    createComponent(['#old']);
    api.getStatistics.mockReturnValue(mockStatistics(['#old', '#new']));

    component['onRenameTag']('#old', '#new');

    expect(component['tagManagement']()).toEqual([buildTagManagement('#old', {}), buildTagManagement('#new', {})]);
  });

  it('does not rename when the new tag is empty or unchanged', () => {
    createComponent(['#old']);

    component['onRenameTag']('#old', '   ');
    component['onRenameTag']('#old', '#old');

    expect(confirm.ifConfirmed).not.toHaveBeenCalled();
    expect(tagManagementService.renameTag).not.toHaveBeenCalled();
  });

  it('does not rename when rename is not confirmed', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);
    createComponent(['#old']);

    component['onRenameTag']('#old', '#new');

    expect(tagManagementService.renameTag).not.toHaveBeenCalled();
    expect(component['tagManagement']()).toEqual([buildTagManagement('#old', {})]);
  });

  it('shows toast message when renaming a tag fails', () => {
    createComponent(['#old']);
    tagManagementService.renameTag.mockReturnValueOnce(throwError(() => new Error('fail')));

    component['onRenameTag']('#old', '#new');

    expect(toastState.state.message()).toBe('Toast.TagRenameError');
    expect(component['tagManagement']()).toEqual([buildTagManagement('#old', {})]);
  });

  it('does not update the list when the server reports no owned renamed items', () => {
    createComponent(['#shared']);
    tagManagementService.renameTag.mockReturnValueOnce(of({ renamedItemCount: 0, tagManagement: [] }));

    component['onRenameTag']('#shared', '#new');

    expect(toastState.state.message()).toBe('Toast.TagRenameNoOwnedItems');
    expect(component['tagManagement']()).toEqual([buildTagManagement('#shared', {})]);
  });
});
