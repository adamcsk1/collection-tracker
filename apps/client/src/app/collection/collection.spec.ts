import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Collection } from './collection';

jest.mock('marked', () => ({ marked: jest.fn(() => '') }));

describe('Collection component', () => {
  let fixture: ComponentFixture<Collection>;
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        { provide: AutocompleteService, useValue: { search: jest.fn() } },
      ],
    });

    TestBed.overrideComponent(Collection, {
      set: { template: '', imports: [ReactiveFormsModule] },
    });

    fixture = TestBed.createComponent(Collection);
    collectionState = fixture.debugElement.injector.get(collectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialCollectionState
    >;
    fixture.detectChanges();
  });

  it('syncs search text from store to the control', async () => {
    collectionState.setState('searchText', 'neo');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextControl'].value).toBe('neo');
  });

  it('persists search text changes back to the store', async () => {
    fixture.componentInstance['searchTextControl'].setValue('trinity');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('trinity');
  });
});
