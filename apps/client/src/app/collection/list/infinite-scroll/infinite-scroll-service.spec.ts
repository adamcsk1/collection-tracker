import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '../../collection-model';
import { beforeEach, describe, expect, it } from 'vitest';
import { INFINITE_SCROLL_PAGE_SIZE } from './infinite-scroll-const';
import { InfiniteScrollService } from './infinite-scroll-service';

const buildItem = (title: string): CollectionItemModel => ({
  image: '',
  title,
  titleLower: title.toLowerCase(),
  genre: [],
  IMDbId: '',
  tags: [],
  year: null,
  rate: '',
  hash: '',
  actors: '',
  plot: '',
});

describe('InfiniteScrollService', () => {
  let service: InfiniteScrollService;

  const makeCollection = (size: number) =>
    signal(Array.from({ length: size }, (_, index) => buildItem(`Item ${index}`)));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InfiniteScrollService] });
    service = TestBed.inject(InfiniteScrollService);
  });

  it('shows the first page of items initially', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE + 10));

    expect(service.visibleItems().length).toBe(INFINITE_SCROLL_PAGE_SIZE);
    expect(service.visibleItems()[0].title).toBe('Item 0');
  });

  it('hasMore is true when collection exceeds visible count', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE + 1));

    expect(service.hasMore()).toBe(true);
  });

  it('hasMore is false when all items fit in the initial view', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE - 1));

    expect(service.hasMore()).toBe(false);
  });

  it('loadMore reveals the next batch of items', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE * 2));

    service.loadMore();

    expect(service.visibleItems().length).toBe(INFINITE_SCROLL_PAGE_SIZE * 2);
  });

  it('loadMore clamps to the total collection length', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE + 5));

    service.loadMore();

    expect(service.visibleItems().length).toBe(INFINITE_SCROLL_PAGE_SIZE + 5);
    expect(service.hasMore()).toBe(false);
  });

  it('reset restores visible count to the initial page size', () => {
    service.setCollectionSource(makeCollection(INFINITE_SCROLL_PAGE_SIZE * 3));
    service.loadMore();

    service.reset();

    expect(service.visibleItems().length).toBe(INFINITE_SCROLL_PAGE_SIZE);
    expect(service.hasMore()).toBe(true);
  });
});
