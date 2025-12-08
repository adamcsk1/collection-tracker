import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import * as randomIntUtil from '@shared/utils/random-int-util';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { List } from './list';

jest.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('List', () => {
  let fixture: ComponentFixture<List>;
  let component: List;
  let portal: { open: jest.Mock };
  let mainCollectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;
  let scrollSpy: jest.Mock;

  const buildItem = (name: string): CollectionItemModel => ({
    rawContent: name,
    image: '',
    title: name,
    genre: [],
    IMDbId: '',
    tags: [],
    name,
    year: null,
    rate: '',
  });

  beforeEach(() => {
    portal = { open: jest.fn() };
    TestBed.configureTestingModule({
      imports: [List],
      providers: [
        { provide: PortalService, useValue: portal },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    mainCollectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
    collectionState = TestBed.inject(collectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialCollectionState
    >;

    scrollSpy = jest.fn();
    (component as any).scrollContainer = () => ({ nativeElement: { scrollTo: scrollSpy } }) as ElementRef;
  });

  it('filters collection based on search text and resets scroll position', () => {
    jest.spyOn(component as any, 'resetScrollPosition');
    mainCollectionState.setState('collection', [buildItem('Alpha'), buildItem('Beta')]);
    collectionState.setState('searchText', 'be');

    const filtered = component['filteredCollection']();

    expect(filtered).toEqual([buildItem('Beta')]);
    expect(component['resetScrollPosition']).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('opens a random item from the filtered collection', () => {
    jest.spyOn(randomIntUtil, 'randomInt').mockReturnValue(1);
    mainCollectionState.setState('collection', [buildItem('First'), buildItem('Second'), buildItem('Third')]);

    component['onRandomPick']();

    expect(portal.open).toHaveBeenCalledWith(ItemDialog, {
      collectionItem: expect.objectContaining({ name: 'Second' }),
    });
  });

  it('paginates forward and backward with bounds enforced', () => {
    const largeCollection = Array.from({ length: 200 }, (_, index) => buildItem(`Item ${index}`));
    mainCollectionState.setState('collection', largeCollection);

    component['onNextPage']();
    expect(component['offset']()).toBe(199);

    component['onPreviousPage']();
    expect(component['offset']()).toBe(49);

    component['onFirstPage']();
    expect(component['offset']()).toBe(0);
  });

  it('clamps pagination when navigating beyond bounds', () => {
    const smallCollection = [buildItem('Only'), buildItem('Two')];
    mainCollectionState.setState('collection', smallCollection);

    component['onNextPage']();
    expect(component['offset']()).toBe(1);

    component['onPreviousPage']();
    expect(component['offset']()).toBe(0);
  });

  it('computes next/previous disable flags', () => {
    const largeCollection = Array.from({ length: 200 }, (_, index) => buildItem(`Item ${index}`));
    mainCollectionState.setState('collection', largeCollection);

    expect(component['disablePreviousButton']()).toBe(true);
    expect(component['disableNextButton']()).toBe(false);

    component['onNextPage']();

    expect(component['disablePreviousButton']()).toBe(false);
    expect(component['disableNextButton']()).toBe(true);
  });

  it('resets scroll position with expected options', () => {
    mainCollectionState.setState('collection', [buildItem('Alpha')]);

    component['onFirstPage']();

    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, left: 1000, behavior: 'smooth' });
  });
});
