import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from './collection';

vi.mock('marked', () => ({ marked: vi.fn(() => '') }));

describe('Collection component', () => {
  let fixture: ComponentFixture<Collection>;
  let collectionState: NgxSimpleSignalStoreService<typeof initialCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    });

    TestBed.overrideComponent(Collection, {
      set: { template: '' },
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

    expect(fixture.componentInstance['searchTextModel']()).toBe('neo');
  });

  it('persists search text changes back to the store', async () => {
    fixture.componentInstance['searchTextModel'].set('trinity');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('trinity');
  });
});
