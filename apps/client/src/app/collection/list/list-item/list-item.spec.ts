import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { PortalService } from '@services/portal-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListItem } from './list-item';
import { MOVIE_TAG, SERIES_TAG, WATCHED_TAG } from '@shared/constants/tags-const';

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

vi.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('ListItem', () => {
  let fixture: ComponentFixture<ListItem>;
  let component: ListItem;
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;
  let portal: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portal = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ListItem],
      providers: [
        { provide: PortalService, useValue: portal },
        provideStore(initialCollectionState, collectionStateToken),
      ],
    });

    fixture = TestBed.createComponent(ListItem);
    component = fixture.componentInstance;
    collectionState = TestBed.inject(collectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialCollectionState
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
});
