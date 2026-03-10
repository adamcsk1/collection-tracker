import { TestBed } from '@angular/core/testing';
import { PAGINATION_PAGE_SIZE } from '@client/collection/list/pagination/pagination-const';
import { CollectionItemModel } from '@client/collection/collection-model';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaginationService } from './pagination-service';

const buildItem = (name: string): CollectionItemModel => ({
  rawContent: name,
  rawContentLower: name.toLowerCase(),
  image: '',
  title: name,
  titleLower: name.toLowerCase(),
  genre: [],
  IMDbId: '',
  tags: [],
  name,
  year: null,
  rate: '',
});

describe('PaginationService', () => {
  let service: PaginationService;

  const makeCollection = (size: number) => signal(Array.from({ length: size }, (_, i) => buildItem(`Item ${i}`)));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PaginationService] });
    service = TestBed.inject(PaginationService);
  });

  it('starts at offset zero', () => {
    service.setCollectionSource(makeCollection(10));

    expect(service.offset()).toBe(0);
  });

  it('slices the first page from the collection', () => {
    const collection = makeCollection(PAGINATION_PAGE_SIZE + 10);
    service.setCollectionSource(collection);

    expect(service.paginatedItems().length).toBe(PAGINATION_PAGE_SIZE);
    expect(service.paginatedItems()[0].name).toBe('Item 0');
  });

  it('disablePrevious is true on the first page', () => {
    service.setCollectionSource(makeCollection(5));

    expect(service.disablePrevious()).toBe(true);
  });

  it('disableNext is false when there are more items than one page', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE + 1));

    expect(service.disableNext()).toBe(false);
  });

  it('disableNext is true when all items fit on one page', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE - 1));

    expect(service.disableNext()).toBe(true);
  });

  it('nextPage advances offset and clamps to the last index', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE + 5));

    service.nextPage();

    expect(service.offset()).toBe(PAGINATION_PAGE_SIZE + 4); // last index of 155 items
  });

  it('nextPage clamps to last index when collection is smaller than page size', () => {
    service.setCollectionSource(makeCollection(3));

    service.nextPage();

    expect(service.offset()).toBe(2); // last index of 3 items
  });

  it('previousPage decrements offset by page size', () => {
    const collection = makeCollection(PAGINATION_PAGE_SIZE * 2);
    service.setCollectionSource(collection);
    service.nextPage();
    const offsetAfterNext = service.offset();

    service.previousPage();

    expect(service.offset()).toBe(offsetAfterNext - PAGINATION_PAGE_SIZE);
  });

  it('previousPage clamps to zero', () => {
    service.setCollectionSource(makeCollection(10));

    service.previousPage();

    expect(service.offset()).toBe(0);
  });

  it('firstPage resets offset to zero', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE + 5));
    service.nextPage();

    service.firstPage();

    expect(service.offset()).toBe(0);
  });

  it('lastPage jumps to the last item index', () => {
    const collection = makeCollection(5);
    service.setCollectionSource(collection);

    service.lastPage();

    expect(service.offset()).toBe(4);
  });

  it('disablePrevious becomes false after advancing past the first page', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE + 5));

    service.nextPage();

    expect(service.disablePrevious()).toBe(false);
  });

  it('disableNext becomes true after advancing to the last page', () => {
    service.setCollectionSource(makeCollection(PAGINATION_PAGE_SIZE + 5));

    service.nextPage();

    expect(service.disableNext()).toBe(true);
  });
});
