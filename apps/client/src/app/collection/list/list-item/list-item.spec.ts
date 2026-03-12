import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { initialTagConfigsState, tagConfigsStateToken } from '@client/tag-configs/tag-configs-store';
import { PortalService } from '@services/portal-service';
import { MOVIE_TAG, SERIES_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListItem } from './list-item';

const buildItem = (name: string, tags: Array<string> = []): CollectionItemModel => ({
  rawContent: name,
  rawContentLower: name.toLowerCase(),
  image: '',
  title: name,
  titleLower: name.toLowerCase(),
  genre: [],
  IMDbId: '',
  tags,
  name,
  year: null,
  rate: '',
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
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;
  let tagConfigsState: NgxSimpleSignalStoreService<typeof initialTagConfigsState>;
  let portal: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portal = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ListItem],
      providers: [
        { provide: PortalService, useValue: portal },
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialTagConfigsState, tagConfigsStateToken),
      ],
    });

    fixture = TestBed.createComponent(ListItem);
    component = fixture.componentInstance;
    collectionState = TestBed.inject(collectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialCollectionState
    >;
    tagConfigsState = TestBed.inject(tagConfigsStateToken) as NgxSimpleSignalStoreService<
      typeof initialTagConfigsState
    >;

    fixture.componentRef.setInput('collectionItem', buildItem('Sample'));
    fixture.detectChanges();
  });

  it('sets search text when provided value is not null', () => {
    component['onSetSearchText']('query');

    expect(collectionState.state.searchText()).toBe('query');
  });

  it('opens the item dialog with current collection item', () => {
    fixture.componentRef.setInput('collectionItem', buildItem('Sample', [WATCHED_TAG]));
    fixture.detectChanges();

    component['onOpenDetail']();

    expect(portal.open).toHaveBeenCalledWith(expect.any(Function), {
      collectionItem: expect.objectContaining(buildItem('Sample', [WATCHED_TAG])),
    });
  });

  it('derives watched, movie, series, and non-internal tags', () => {
    fixture.componentRef.setInput(
      'collectionItem',
      buildItem('Sample', [WATCHED_TAG, MOVIE_TAG, SERIES_TAG, '#tag1', '#tag2'])
    );
    fixture.detectChanges();

    expect(component['watched']()).toBe(true);
    expect(component['movie']()).toBe(true);
    expect(component['series']()).toBe(true);
    expect(component['tags']()).toEqual(['#tag1', '#tag2']);
    expect(component['WATCHED_TAG']).toBe(WATCHED_TAG);
    expect(component['MOVIE_TAG']).toBe(MOVIE_TAG);
    expect(component['SERIES_TAG']).toBe(SERIES_TAG);
    expect(component['VIRTUAL_UNWATCHED_TAG']).toBe('#unwatched');
  });

  it('stores forceStandardSearch flag when setting search text', () => {
    component['onSetSearchText']('query');

    expect(collectionState.state.searchText()).toBe('query');
    expect(collectionState.state.forceStandardSearch()).toBe(true);
  });

  it('applies tag-config-driven colors to image border and tag text', () => {
    tagConfigsState.setState('configs', [
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

    const image = fixture.nativeElement.querySelector('.image') as HTMLElement;
    const getBlueTagAnchor = (): HTMLAnchorElement | undefined =>
      Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a')).find(
        (link: HTMLAnchorElement) => link.textContent?.trim() === '#blue'
      );

    expect(['#112233', normalizeHexColor('#112233')]).toContain(image.style.borderColor);
    expect(['#112233', normalizeHexColor('#112233')]).toContain(getBlueTagAnchor()?.style.color);

    tagConfigsState.setState('configs', [
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
      image.style.borderColor
    );
    expect(getBlueTagAnchor()?.getAttribute('style') ?? '').not.toContain('112233');
  });

  it('renders image badge for the first matching image-badge tag and hides it from secondary tags', () => {
    tagConfigsState.setState('configs', [
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
      fixture.nativeElement.querySelector('.image')?.style.borderColor
    );
  });

  it('sets search text to image badge tag when image badge is clicked', () => {
    const collectionItem = buildItem('Sample', ['#badge']);
    collectionItem.rate = '8.7';
    tagConfigsState.setState('configs', [
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
