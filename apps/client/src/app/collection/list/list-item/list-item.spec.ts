import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, MainState, mainStateToken } from '../../../main/main-store';
import {
  initialTagManagementState,
  TagManagementState,
  tagManagementStateToken,
} from '../../../tag-management/tag-management-store';
import { initialSharesState, SharesState, sharesStateToken } from '../../../shares/shares-store';
import { CollectionItemModel } from '../../collection-model';
import { CollectionState, collectionStateToken, initialCollectionState } from '../../collection-store';
import { ListItem } from './list-item';

const COMPLETED_TAG = '#completed';
const FAVORITE_TAG = '#favorite';
const MOVIE_TAG = '#movie';
const SERIES_TAG = '#series';

const buildItem = (title: string, tags: string[] = []): CollectionItemModel => ({
  image: '',
  title,
  titleLower: title.toLowerCase(),
  genre: [],
  IMDbId: '',
  externalProvider: 'omdb',
  externalItemId: '',
  tags: tags.filter((tag) => ![FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, COMPLETED_TAG].includes(tag)),
  year: null,
  rate: '',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  hash: '',
  actors: '',
  plot: '',
  listType: 'library',
  contentType: tags.includes(SERIES_TAG) && !tags.includes(MOVIE_TAG) ? 'series' : 'movie',
  favorite: tags.includes(FAVORITE_TAG),
  watchedAt: tags.includes(COMPLETED_TAG) ? '2025-01-01 00:00:00' : null,
});

const normalizeHexColor = (hex: string): string => {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.substring(0, 2), 16);
  const green = parseInt(normalized.substring(2, 4), 16);
  const blue = parseInt(normalized.substring(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
};
const normalizeStyleValue = (value: string): string => value.replace(/\s/g, '').toLowerCase();

vi.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('ListItem', () => {
  let fixture: ComponentFixture<ListItem>;
  let component: ListItem;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let tagManagementState: NgxSimpleSignalStoreService<TagManagementState>;
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;
  let portal: { open: ReturnType<typeof vi.fn> };
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portal = { open: vi.fn() };
    translate = {
      translate: vi.fn((key: string) => ({ MetacriticShort: 'MC', RottenTomatoesShort: 'RT' })[key] ?? key),
    };
    TestBed.configureTestingModule({
      imports: [ListItem],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialTagManagementState, tagManagementStateToken),
        provideStore(initialSharesState, sharesStateToken),
      ],
    });

    fixture = TestBed.createComponent(ListItem);
    component = fixture.componentInstance;
    collectionState = TestBed.inject(collectionStateToken);
    mainState = TestBed.inject(mainStateToken);
    tagManagementState = TestBed.inject(tagManagementStateToken);
    sharesState = TestBed.inject(sharesStateToken);

    fixture.componentRef.setInput('collectionItem', buildItem('Sample'));
    fixture.detectChanges();
  });

  it('sets search text when provided value is not null', () => {
    component['onSetSearchText']('query');

    expect(collectionState.state.searchText()).toBe('query');
  });

  it('opens the item dialog with current collection item', () => {
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', ['#action']));
    fixture.detectChanges();

    component['onOpenDetail']();

    expect(portal.open).toHaveBeenCalledWith(expect.any(Function), {
      collectionItem: expect.objectContaining(buildItem('Sample', ['#action'])),
    });
  });

  it('marks an item as shared when its owner matches an incoming share', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
        ],
      },
    ]);
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Shared', []), ownerShareCode: 'owner-code' });
    fixture.detectChanges();

    expect(component['shared']()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-shared"]')).not.toBeNull();
  });

  it('derives favorite, movie, series, and display tags', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, '#tag1', '#tag2']),
      tags: [FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, '#tag1', '#tag2'],
      watched: true,
    });
    fixture.detectChanges();

    expect(component['favorite']()).toBe(true);
    expect(component['movie']()).toBe(true);
    expect(component['series']()).toBe(false);
    expect(component['tags']()).toEqual([FAVORITE_TAG, MOVIE_TAG, SERIES_TAG, '#tag1', '#tag2']);
  });

  it('renders a favorite star for favorite items', () => {
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', [FAVORITE_TAG]));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-favorite"]')).not.toBeNull();
  });

  it('renders completed status for completed tracking items', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [SERIES_TAG, COMPLETED_TAG]),
      listType: 'tracking',
    });
    fixture.detectChanges();

    const completed = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test-id="list-item-tracking-completed"]'
    );
    expect(completed).not.toBeNull();
    expect(completed?.textContent?.trim()).toBe('check_circle');
    expect(completed?.getAttribute('aria-label')).toBe('Completed');
    expect(completed?.getAttribute('title')).toBe('Completed');
    expect((fixture.nativeElement as HTMLElement).querySelector('.poster-image')?.classList).toContain(
      'completed-image'
    );
  });

  it('renders completed status for completed tracking items', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [MOVIE_TAG]),
      listType: 'tracking',
      watchedAt: '2025-01-01 00:00:00',
    });
    fixture.detectChanges();

    const completed = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-test-id="list-item-tracking-completed"]'
    );
    expect(completed).not.toBeNull();
    expect(completed?.textContent?.trim()).toBe('check_circle');
    expect(completed?.getAttribute('aria-label')).toBe('Completed');
    expect(completed?.getAttribute('title')).toBe('Completed');
    expect((fixture.nativeElement as HTMLElement).querySelector('.poster-image')?.classList).toContain(
      'completed-image'
    );
  });

  it('does not render completed status for partial tracking items', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [SERIES_TAG]),
      listType: 'tracking',
      watchedAt: null,
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-tracking-completed"]')
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-finished"]')).toBeNull();
  });

  it('does not render completed status for non-tracking items with completed tag', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [SERIES_TAG, COMPLETED_TAG]),
      listType: 'library',
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-tracking-completed"]')
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.poster-image')?.classList).not.toContain(
      'completed-image'
    );
  });

  it('does not render completed status for library items with twin-derived watched flag', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample', [MOVIE_TAG]),
      listType: 'library',
      watched: true,
      watchedAt: null,
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-tracking-completed"]')
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-finished"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.poster-image')?.classList).not.toContain(
      'completed-image'
    );
  });

  it('renders external ratings when present', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample'),
      rate: '8.1',
      rottenTomatoesRate: '96%',
      metacriticRate: '85/100',
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('8.1');
    expect(text).not.toContain('RT 96%');
    expect(text).not.toContain('MC 85/100');
  });

  it('hides the year when collection list display settings disable it', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      showYear: false,
    });
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Sample'), year: '2024' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-year"]')).toBeNull();
  });

  it('shows book reading progress on tracking list cards', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Tracking Book'),
      listType: 'tracking',
      contentType: 'book',
      year: '2020',
      progressCurrent: 55,
      progressTotal: 200,
      watchedAt: null,
    });
    fixture.detectChanges();

    const progress = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-progress"]');
    expect(progress?.textContent?.trim()).toBe('2020 · 55 / 200');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-year"]')).toBeNull();
  });

  it('shows book progress without year when year display is disabled', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      showYear: false,
    });
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Tracking Book'),
      listType: 'tracking',
      contentType: 'book',
      year: '2020',
      progressCurrent: 12,
      progressTotal: 100,
      watchedAt: null,
    });
    fixture.detectChanges();

    const progress = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-progress"]');
    expect(progress?.textContent?.trim()).toBe('12 / 100');
  });

  it.each([
    [25, null, '25'],
    [null, 100, '100'],
  ] as const)('shows partial book progress %s of %s', (progressCurrent, progressTotal, expected) => {
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Tracking Book'),
      listType: 'tracking',
      contentType: 'book',
      progressCurrent,
      progressTotal,
      watchedAt: null,
    });
    fixture.detectChanges();

    expect(component['bookProgressText']()).toBe(expected);
  });

  it('renders user rating and handles missing user rating', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      preferredRating: 'user',
    });
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Rated'), userRate: 8.5 });
    fixture.detectChanges();

    expect(component['selectedRating']()).toEqual({
      label: '',
      value: 8.5,
      testId: 'list-item-user-rate',
      icon: 'person',
    });

    fixture.componentRef.setInput('collectionItem', { ...buildItem('Unrated'), userRate: null });
    fixture.detectChanges();
    expect(component['selectedRating']()).toBeNull();
  });

  it('exposes every translated list item label', () => {
    expect(component['translations'].completed()).toBe('Completed');
    expect(component['translations'].favorite()).toBe('Favorite');
    expect(component['translations'].metacriticShort()).toBe('MC');
    expect(component['translations'].rottenTomatoesShort()).toBe('RT');
    expect(component['translations'].shared()).toBe('Shared');
  });

  it('hides the shared icon when collection list display settings disable it', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      showSharedIcon: false,
    });
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        grants: [
          {
            listType: 'library',
            contentType: 'movie',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
          {
            listType: 'library',
            contentType: 'series',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          },
        ],
      },
    ]);
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Shared', []), ownerShareCode: 'owner-code' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-shared"]')).toBeNull();
  });

  it('renders the selected preferred rating only', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      preferredRating: 'metacritic',
    });
    fixture.componentRef.setInput('collectionItem', {
      ...buildItem('Sample'),
      rate: '8.1',
      rottenTomatoesRate: '96%',
      metacriticRate: '85/100',
    });
    fixture.detectChanges();

    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('MC 85/100');
    expect(text).not.toContain('8.1');
    expect(text).not.toContain('RT 96%');
  });

  it('falls back to IMDb when selected rating is unavailable and fallback is enabled', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      preferredRating: 'rottenTomatoes',
      imdbRatingFallback: true,
    });
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Sample'), rate: '8.1', rottenTomatoesRate: '' });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-item-rating-imdb"]')
    ).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('8.1');
  });

  it('does not fall back to IMDb when fallback is disabled', () => {
    mainState.setState('collectionListDisplayPreferences', {
      ...mainState.state.collectionListDisplayPreferences(),
      preferredRating: 'rottenTomatoes',
      imdbRatingFallback: false,
    });
    fixture.componentRef.setInput('collectionItem', { ...buildItem('Sample'), rate: '8.1', rottenTomatoesRate: '' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id^="list-item-rating-"]')).toBeNull();
  });

  it('stores forceStandardSearch flag when setting search text', () => {
    component['onSetSearchText']('query');

    expect(collectionState.state.searchText()).toBe('query');
    expect(collectionState.state.forceStandardSearch()).toBe(true);
  });

  it('applies tag-management-driven colors to image border', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: '#112233',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
      {
        tag: '#red',
        color: '#ff0000',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 2,
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', ['#blue', '#red']));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(['#112233', normalizeHexColor('#112233')]).toContain(host.style.borderColor);

    tagManagementState.setState('configs', [
      {
        tag: '#blue',
        color: '#112233',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
    fixture.detectChanges();
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', ['#blue', '#red']));
    fixture.detectChanges();

    expect(['', 'transparent', 'rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgb(0,0,0)', 'rgba(0,0,0,0)']).toContain(
      host.style.borderColor
    );
  });

  it('renders image badge for the first matching image-badge tag and hides it from secondary tags', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#badge-red',
        color: '#ff0000',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
      {
        tag: '#normal',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: true,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', ['#normal', '#badge-red', '#other']));
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLAnchorElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('#badge-red');
    expect(component['imageBadgeTag']()).toBe('#badge-red');
    expect(component['tags']()).toEqual(['#normal', '#other']);
    expect(['#ff0000', normalizeHexColor('#ff0000')]).toContain(badge.style.backgroundColor);
    expect(['#ffffff', 'rgb(255,255,255)', 'rgb(255, 255, 255)']).toContain(normalizeStyleValue(badge.style.color));
    expect(['#111111', normalizeHexColor('#111111')]).toContain(
      (fixture.nativeElement as HTMLElement).style.borderColor
    );
  });

  it('renders image badge with default color when badge tag has no color', () => {
    tagManagementState.setState('configs', [
      {
        tag: '#badge-default',
        color: null,
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', ['#badge-default']));
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLAnchorElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('#badge-default');
    expect(component['imageBadgeTag']()).toBe('#badge-default');
    expect(['#000000', normalizeHexColor('#000000')]).toContain(badge.style.backgroundColor);
    expect(['#ffffff', 'rgb(255,255,255)', 'rgb(255, 255, 255)']).toContain(normalizeStyleValue(badge.style.color));
  });

  it('does nothing when AI filter is active', () => {
    collectionState.setState('aiSearchPromptText', 'sci-fi');
    collectionState.setState('forceStandardSearch', false);

    component['onSetSearchText']('query');

    expect(collectionState.state.searchText()).toBe('');
    expect(collectionState.state.forceStandardSearch()).toBe(false);
  });

  it('does nothing when search value is null', () => {
    component['onSetSearchText'](null);

    expect(collectionState.state.searchText()).toBe('');
    expect(collectionState.state.forceStandardSearch()).toBe(false);
  });

  it('stops event propagation when search value is not null', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

    component['onSetSearchText']('query', event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('stops event propagation when search value is null', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

    component['onSetSearchText'](null, event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('converts number search value to string', () => {
    component['onSetSearchText'](42);

    expect(collectionState.state.searchText()).toBe('42');
  });

  it('sets search text to image badge tag when image badge is clicked', () => {
    const collectionItem = buildItem('Sample', ['#badge']);
    collectionItem.rate = '8.7';
    tagManagementState.setState('configs', [
      {
        tag: '#badge',
        color: '#fefefe',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
    ]);

    fixture.componentRef.setInput('collectionItem', collectionItem);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLAnchorElement;
    badge.click();

    expect(collectionState.state.searchText()).toBe('#badge');
    expect(collectionState.state.forceStandardSearch()).toBe(true);
  });
});
