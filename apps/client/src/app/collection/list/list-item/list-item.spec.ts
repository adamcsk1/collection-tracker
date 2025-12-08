import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { PortalService } from '@services/portal-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { ListItem } from './list-item';

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

jest.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('ListItem', () => {
  let fixture: ComponentFixture<ListItem>;
  let component: ListItem;
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;
  let portal: { open: jest.Mock };

  beforeEach(() => {
    portal = { open: jest.fn() };
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
    component['onOpenDetail']();

    expect(portal.open).toHaveBeenCalledWith(expect.any(Function), { collectionItem: buildItem('Sample') });
  });
});
