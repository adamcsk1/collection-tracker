import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '../../../main/main-collection-store';
import { initialMainState, MainState, mainStateToken } from '../../../main/main-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharesLoaderService } from '../../../shares/shares-loader-service';
import { initialSharesState, SharesState, sharesStateToken } from '../../../shares/shares-store';
import { NewItemDialog } from './new-item-dialog';
import { NewItemDialogService } from './new-item-dialog-service';

describe('NewItemDialog component', () => {
  type MatchedContent = { text: string; value: string };
  const matrixReference = 'omdb/tt123';

  let fixture: ComponentFixture<NewItemDialog>;
  let component: NewItemDialog;
  let service: {
    matchedContent: ReturnType<typeof signal<MatchedContent[]>>;
    completedSearchText: ReturnType<typeof signal<string>>;
    search: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    getProviderReference: ReturnType<typeof vi.fn>;
  };
  let api: { collectionItemExists: ReturnType<typeof vi.fn>; getShares: ReturnType<typeof vi.fn> };
  let mainState: NgxSimpleSignalStoreService<MainState>;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = {
      matchedContent: signal([{ text: 'First', value: 'tt123' }]),
      completedSearchText: signal(''),
      search: vi.fn(),
      save: vi.fn(() => of(undefined)),
      getProviderReference: vi.fn((value: string | null) =>
        value === matrixReference ? { identitySource: 'omdb', identityId: 'tt123' } : null
      ),
    };
    api = {
      collectionItemExists: vi.fn(() => of({ exists: false })),
      getShares: vi.fn(() => of({ userShareCode: '', outgoing: [], incoming: [] })),
    };

    TestBed.configureTestingModule({
      imports: [NewItemDialog],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialSharesState, sharesStateToken),
      ],
    });

    TestBed.overrideComponent(NewItemDialog, {
      set: {
        template: '',
        providers: [
          { provide: NewItemDialogService, useValue: service },
          {
            provide: ApiService,
            useValue: api,
          },
          SharesLoaderService,
          {
            provide: AutocompleteService,
            useValue: { getSuggestion: vi.fn(), formatSuggestionText: vi.fn() },
          },
        ],
      },
    });

    fixture = TestBed.createComponent(NewItemDialog);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken);
    sharesState = TestBed.inject(sharesStateToken);
    fixture.detectChanges();
  });

  it('preselects the first matched content and marks control as touched', () => {
    const control = component['form'].selectedIMDbId();

    expect(control.value()).toBe('tt123');
    expect(control.touched()).toBe(true);
  });

  it('debounces search text updates before calling search', () => {
    const control = component['form'].searchText();

    control.value.set('matrix');
    vi.advanceTimersByTime(500);

    expect(service.search).toHaveBeenCalledWith('matrix');
  });

  it('searches immediately without clearing the search text when enter is pressed', () => {
    const preventDefault = vi.fn();
    component['form'].searchText().value.set('matrix');

    component['onSearchEnter']({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(service.search).toHaveBeenCalledWith('matrix');
    expect(component['form'].searchText().value()).toBe('matrix');
  });

  it('shows external search links for the completed title search', () => {
    component['form'].searchText().value.set('The Matrix');
    service.completedSearchText.set('The Matrix');

    expect(component['showExternalSearchLinks']()).toBe(true);
    expect(component['imdbSearchUrl']()).toBe('https://www.imdb.com/find/?q=The%20Matrix');
    expect(component['webSearchUrl']()).toBe('https://duckduckgo.com/?q=The%20Matrix');
  });

  it('hides external search links when the input changes after the completed search', () => {
    component['form'].searchText().value.set('The Matrix Reloaded');
    service.completedSearchText.set('The Matrix');

    expect(component['showExternalSearchLinks']()).toBe(false);
  });

  it('invokes save and resets when mode is new', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');
    component['form'].selectedIMDbId().value.set(matrixReference);
    component['form'].userRate().value.set(8.7);
    component['form'].tags().value.set('#tag');

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith(matrixReference, 8.7, '#tag', 'new', {});
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('does not append watched tag before saving in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'new', {});
    expect(formRoot.reset).toHaveBeenCalled();
    expect(component['form'].watched().value()).toBe(false);
  });

  it('saves empty tags when only watched is selected in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '', 'new', {});
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('passes watched only for selected library movie content', async () => {
    service.matchedContent.set([{ text: '(movie) Test Movie (2020)', value: 'tt-movie' }]);
    component['form'].selectedIMDbId().value.set('tt-movie');
    component['form'].watched().value.set(true);

    expect(component['showWatchedCheckbox']()).toBe(true);

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt-movie', null, '', 'close', { watched: true });
  });

  it('hides watched for selected series content', async () => {
    service.matchedContent.set([{ text: '(series) Test Series (2020)', value: 'tt-series' }]);
    component['form'].selectedIMDbId().value.set('tt-series');
    component['form'].watched().value.set(true);

    await component['onSave']('close');

    expect(component['showWatchedCheckbox']()).toBe(false);
    expect(service.save).toHaveBeenCalledWith('tt-series', null, '', 'close', { copyToSeriesTrackerAsWatched: false });
  });

  it('shows copy-to-series-tracker checkbox for selected series content in library mode', () => {
    service.matchedContent.set([{ text: '(series) Test Series (2020)', value: 'tt-series' }]);
    component['form'].selectedIMDbId().value.set('tt-series');

    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(true);
  });

  it('hides copy-to-series-tracker checkbox for selected movie content', () => {
    service.matchedContent.set([{ text: '(movie) Test Movie (2020)', value: 'tt-movie' }]);
    component['form'].selectedIMDbId().value.set('tt-movie');

    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(false);
  });

  it('hides copy-to-series-tracker checkbox for manual imdb id selection', () => {
    service.matchedContent.set([{ text: 'IMDb id: tt123', value: 'tt123' }]);
    component['form'].selectedIMDbId().value.set('tt123');

    expect(component['showWatchedCheckbox']()).toBe(true);
    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(false);
  });

  it('hides copy-to-series-tracker checkbox in internal list modes', () => {
    service.matchedContent.set([{ text: '(series) Test Series (2020)', value: 'tt-series' }]);
    component['form'].selectedIMDbId().value.set('tt-series');

    fixture.componentRef.setInput('watchLater', true);
    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(false);

    fixture.componentRef.setInput('watchLater', false);
    fixture.componentRef.setInput('wishlist', true);
    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(false);

    fixture.componentRef.setInput('wishlist', false);
    fixture.componentRef.setInput('seriesTracker', true);
    expect(component['showCopyToSeriesTrackerCheckbox']()).toBe(false);
  });

  it('passes copy-to-series-tracker-as-watched flag when checked', async () => {
    service.matchedContent.set([{ text: '(series) Test Series (2020)', value: 'tt-series' }]);
    component['form'].selectedIMDbId().value.set('tt-series');
    component['form'].copyToSeriesTrackerAsWatched().value.set(true);

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt-series', null, '', 'close', { copyToSeriesTrackerAsWatched: true });
  });

  it('resets only the IMDb ID field when mode is not new', async () => {
    const selectedIMDbId = component['form'].selectedIMDbId();
    vi.spyOn(selectedIMDbId, 'reset');
    selectedIMDbId.value.set('tt456');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt456', null, '', 'close', {});
    expect(selectedIMDbId.reset).toHaveBeenCalledWith(null);
  });

  it('saves to the selected shared library', async () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '', 'close', { targetOwnerShareCode: 'owner-code' });
  });

  it('selects the configured default shared library', () => {
    mainState.setState('defaultLibraryOwnerShareCode', 'owner-code');
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);
    fixture.detectChanges();

    expect(component['form'].targetOwnerShareCode().value()).toBe('owner-code');
  });

  it('keeps my library selected when the configured default is not creatable', () => {
    mainState.setState('defaultLibraryOwnerShareCode', 'readonly-code');
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'readonly-code',
        ownerUsername: 'Read Only Owner',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    ]);
    fixture.detectChanges();

    expect(component['form'].targetOwnerShareCode().value()).toBe(null);
  });

  it('saves wishlist items without watched or shared library values', async () => {
    fixture.componentRef.setInput('wishlist', true);
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);
    component['form'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'close', { listType: 'wishlist' });
  });

  it('saves series tracker items without watched, user rate, or shared library values', async () => {
    fixture.componentRef.setInput('seriesTracker', true);
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);
    component['form'].userRate().value.set(8.2);
    component['form'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'close', { listType: 'series-tracker' });
  });

  it('filters matched content to series in series tracker mode', () => {
    fixture.componentRef.setInput('seriesTracker', true);
    service.matchedContent.set([
      { text: 'IMDb id: tt-id', value: 'tt-id' },
      { text: '(movie) Test Movie (2020)', value: 'tt-movie' },
      { text: '(series) Test Series (2021)', value: 'tt-series' },
    ]);
    fixture.detectChanges();

    expect(component['matchedContent']()).toEqual([
      { text: 'IMDb id: tt-id', value: 'tt-id' },
      { text: '(series) Test Series (2021)', value: 'tt-series' },
    ]);
  });

  it('only offers shared libraries with create permission', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'creatable-code',
        ownerUsername: 'Creatable Owner',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      },
      {
        ownerUserShareCode: 'readonly-code',
        ownerUsername: 'Read Only Owner',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    ]);

    expect(component['libraryOptions']()).toEqual([
      { text: 'MyLibrary', value: '' },
      { text: 'SharedLibrary (Creatable Owner)', value: 'creatable-code' },
    ]);
    expect(component['showLibrarySelect']()).toBe(true);
  });

  it('checks duplicate IMDb IDs again when the target library changes', async () => {
    service.matchedContent.set([{ text: 'IMDb id: tt123', value: matrixReference }]);
    component['form'].selectedIMDbId().value.set(matrixReference);
    await vi.advanceTimersByTimeAsync(150);
    api.collectionItemExists.mockClear();

    component['form'].targetOwnerShareCode().value.set('owner-code');
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt123', 'owner-code', undefined, undefined);
  });

  it('does not check duplicate IMDb IDs when the selected value has no provider item ID', async () => {
    component['form'].selectedIMDbId().value.set('tt123');
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).not.toHaveBeenCalled();
  });

  it('exits when there is no selected IMDb id', () => {
    component['form'].selectedIMDbId().value.set(null);

    component['onSave']();

    expect(service.save).not.toHaveBeenCalled();
  });
});
