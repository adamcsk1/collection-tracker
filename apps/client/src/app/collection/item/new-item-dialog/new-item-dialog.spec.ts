import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ExternalMetadataSelectDataModel } from '@shared/models/external-metadata-model';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainCollectionState, mainCollectionStateToken } from '../../../main/main-collection-store';
import { initialMainState, MainState, mainStateToken } from '../../../main/main-store';
import { SharesLoaderService } from '../../../shares/shares-loader-service';
import { initialSharesState, SharesState, sharesStateToken } from '../../../shares/shares-store';
import { NewItemDialog } from './new-item-dialog';
import { NewItemDialogService } from './new-item-dialog-service';

describe('NewItemDialog component', () => {
  const matrixReference = 'omdb/tt123';

  let fixture: ComponentFixture<NewItemDialog>;
  let component: NewItemDialog;
  let service: {
    matchedContent: ReturnType<typeof signal<ExternalMetadataSelectDataModel[]>>;
    completedSearchText: ReturnType<typeof signal<string>>;
    search: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    saveManual: ReturnType<typeof vi.fn>;
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
      saveManual: vi.fn(() => of(undefined)),
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
        provideStore(initialApiState, apiStateToken),
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
        ],
      },
    });

    fixture = TestBed.createComponent(NewItemDialog);
    component = fixture.componentInstance;
    mainState = TestBed.inject(mainStateToken);
    sharesState = TestBed.inject(sharesStateToken);
    fixture.detectChanges();
  });

  it('starts in search mode', () => {
    expect(component['mode']()).toBe('search');
  });

  it('configures stable Search and Manual tab options', () => {
    expect(component['modeTabs']()).toEqual([
      expect.objectContaining({ value: 'search', dataTestId: 'new-item-search-mode' }),
      expect.objectContaining({ value: 'manual', dataTestId: 'new-item-manual-mode' }),
    ]);
  });

  it('switches to manual mode and back preserving drafts', () => {
    component['searchForm'].searchText().value.set('matrix');
    component['manualForm'].title().value.set('Manual Title');

    component['onModeChange']('manual');
    expect(component['mode']()).toBe('manual');
    expect(component['manualForm'].title().value()).toBe('Manual Title');

    component['onModeChange']('search');
    expect(component['mode']()).toBe('search');
    expect(component['searchForm'].searchText().value()).toBe('matrix');
  });

  it('allows manual mode and filters books in books list mode', () => {
    fixture.componentRef.setInput('books', true);
    service.matchedContent.set([
      { contentType: 'movie', text: 'Dune', value: 'omdb/tt1160419' },
      { contentType: 'book', text: 'Dune', value: 'openlibrary/isbn' },
    ]);
    fixture.detectChanges();

    expect(component['modeTabs']()[1].disabled).toBeUndefined();
    expect(component['dialogIcon']()).toBe('menu_book');
    expect(component['matchedContent']()).toEqual([{ contentType: 'book', text: 'Dune', value: 'openlibrary/isbn' }]);
    component['onModeChange']('manual');
    expect(component['mode']()).toBe('manual');
    expect(component['listType']()).toBe('books');
    expect(component['manualForm'].contentType().value()).toBe('book');
  });

  it('preselects the first matched content and marks control as touched', () => {
    const control = component['searchForm'].selectedExternalReference();

    expect(control.value()).toBe('tt123');
    expect(control.touched()).toBe(true);
  });

  it('debounces search text updates before calling search', () => {
    const control = component['searchForm'].searchText();

    control.value.set('matrix');
    vi.advanceTimersByTime(500);

    expect(service.search).toHaveBeenCalledWith('matrix', 'omdb');
  });

  it('cancels a pending search when switching to manual mode', () => {
    service.search.mockClear();
    component['searchForm'].searchText().value.set('matrix');
    vi.advanceTimersByTime(250);

    component['onModeChange']('manual');
    vi.advanceTimersByTime(500);

    expect(service.search).not.toHaveBeenCalled();
  });

  it('searches immediately without clearing the search text when enter is pressed', () => {
    const preventDefault = vi.fn();
    component['searchForm'].searchText().value.set('matrix');

    component['onSearchEnter']({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalled();
    expect(service.search).toHaveBeenCalledWith('matrix', 'omdb');
    expect(component['searchForm'].searchText().value()).toBe('matrix');
  });

  it('selects matched content from the card selector and marks the control as touched', () => {
    const control = component['searchForm'].selectedExternalReference();
    service.matchedContent.set([
      { contentType: 'movie', text: 'First Movie', value: 'omdb/tt-first', year: '1999' },
      { contentType: 'movie', text: 'Second Movie', value: 'omdb/tt-second', year: '2000' },
    ]);
    control.reset(null);

    component['onSelectMatchedContent'](service.matchedContent()[1]!);

    expect(control.value()).toBe('omdb/tt-second');
    expect(control.touched()).toBe(true);
    expect(component['isMatchedContentSelected'](service.matchedContent()[1]!)).toBe(true);
  });

  it('formats matched content card metadata and image URLs', () => {
    const apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', '/api/v1');
    const content = {
      contentType: 'movie',
      poster: 'https://images.example/poster.jpg',
      text: 'Test Movie',
      value: 'omdb/tt-test',
      year: '2026',
    } satisfies ExternalMetadataSelectDataModel;

    expect(component['getMatchedContentImageUrl'](content)).toBe(
      '/api/v1/proxy/image?url=https%3A%2F%2Fimages.example%2Fposter.jpg'
    );
    expect(component['getMatchedContentMeta'](content)).toBe('(movie) 2026');
  });

  it('omits matched content card metadata for direct IMDb ID matches', () => {
    expect(component['getMatchedContentMeta']({ text: 'IMDb id: tt123', value: matrixReference })).toBeNull();
  });

  it('shows external search links for the completed title search', () => {
    component['searchForm'].searchText().value.set('The Matrix');
    service.completedSearchText.set('The Matrix');

    expect(component['showExternalSearchLinks']()).toBe(true);
    expect(component['imdbSearchUrl']()).toBe('https://www.imdb.com/find/?q=The%20Matrix');
    expect(component['webSearchUrl']()).toBe('https://duckduckgo.com/?q=The%20Matrix');
  });

  it('hides external search links when the input changes after the completed search', () => {
    component['searchForm'].searchText().value.set('The Matrix Reloaded');
    service.completedSearchText.set('The Matrix');

    expect(component['showExternalSearchLinks']()).toBe(false);
  });

  it('invokes save and resets when mode is new', async () => {
    const formRoot = component['searchForm']();
    vi.spyOn(formRoot, 'reset');
    component['searchForm'].selectedExternalReference().value.set(matrixReference);
    component['searchForm'].userRate().value.set(8.7);
    component['searchForm'].tags().value.set('#tag');

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith(matrixReference, 8.7, '#tag', 'new', {});
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('does not append watched tag before saving in new mode', async () => {
    const formRoot = component['searchForm']();
    vi.spyOn(formRoot, 'reset');

    component['searchForm'].selectedExternalReference().value.set('tt123');
    component['searchForm'].tags().value.set('#tag');
    component['searchForm'].finished().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'new', { finished: true });
    expect(formRoot.reset).toHaveBeenCalled();
    expect(component['searchForm'].finished().value()).toBe(false);
  });

  it('saves empty tags when only watched is selected in new mode', async () => {
    const formRoot = component['searchForm']();
    vi.spyOn(formRoot, 'reset');

    component['searchForm'].selectedExternalReference().value.set('tt123');
    component['searchForm'].finished().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '', 'new', { finished: true });
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('passes watched only for selected library movie content', async () => {
    service.matchedContent.set([{ contentType: 'movie', text: 'Test Movie', value: 'tt-movie', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-movie');
    component['searchForm'].finished().value.set(true);

    expect(component['showFinishedCheckbox']()).toBe(true);

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt-movie', null, '', 'close', { finished: true });
  });

  it('hides watched for selected series content', async () => {
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([{ contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-series');
    component['searchForm'].finished().value.set(true);

    await component['onSave']('close');

    expect(component['showFinishedCheckbox']()).toBe(false);
    expect(service.save).toHaveBeenCalledWith('tt-series', null, '', 'close', { copyToTrackingAsCompleted: false });
  });

  it('shows copy-to-watching checkbox for selected series content in library mode', () => {
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([{ contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-series');

    expect(component['showCopyToTrackingCheckbox']()).toBe(true);
  });

  it('hides watched checkbox when the tracking feature is disabled', () => {
    mainState.setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      tracking: false,
    });
    component['selectedAddContentType'].set('movie');
    service.matchedContent.set([{ contentType: 'movie', text: 'Test Movie', value: 'tt-movie', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-movie');

    expect(component['showFinishedCheckbox']()).toBe(false);
  });

  it('hides copy-to-watching checkbox when the tracking feature is disabled', () => {
    mainState.setState('collectionFeaturePreferences', {
      ...initialMainState.collectionFeaturePreferences,
      tracking: false,
    });
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([{ contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-series');

    expect(component['showCopyToTrackingCheckbox']()).toBe(false);
  });

  it('hides copy-to-watching checkbox for selected movie content', () => {
    component['selectedAddContentType'].set('movie');
    service.matchedContent.set([{ contentType: 'movie', text: 'Test Movie', value: 'tt-movie', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-movie');

    expect(component['showCopyToTrackingCheckbox']()).toBe(false);
  });

  it('hides copy-to-watching checkbox for manual imdb id selection', () => {
    component['selectedAddContentType'].set('movie');
    service.matchedContent.set([{ text: 'IMDb id: tt123', value: 'tt123' }]);
    component['searchForm'].selectedExternalReference().value.set('tt123');

    expect(component['showFinishedCheckbox']()).toBe(true);
    expect(component['showCopyToTrackingCheckbox']()).toBe(false);
  });

  it('hides copy-to-watching checkbox in internal list modes', () => {
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([{ contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-series');

    fixture.componentRef.setInput('upNext', true);
    expect(component['showCopyToTrackingCheckbox']()).toBe(false);

    fixture.componentRef.setInput('upNext', false);
    fixture.componentRef.setInput('wishlist', true);
    expect(component['showCopyToTrackingCheckbox']()).toBe(false);

    fixture.componentRef.setInput('wishlist', false);
    fixture.componentRef.setInput('tracking', true);
    expect(component['showCopyToTrackingCheckbox']()).toBe(false);
  });

  it('passes copy-to-watching-as-watched flag when checked', async () => {
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([{ contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2020' }]);
    component['searchForm'].selectedExternalReference().value.set('tt-series');
    component['searchForm'].copyToTrackingAsCompleted().value.set(true);

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt-series', null, '', 'close', { copyToTrackingAsCompleted: true });
  });

  it('resets only the IMDb ID field when mode is not new', async () => {
    const selectedExternalReference = component['searchForm'].selectedExternalReference();
    vi.spyOn(selectedExternalReference, 'reset');
    selectedExternalReference.value.set('tt456');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt456', null, '', 'close', {});
    expect(selectedExternalReference.reset).toHaveBeenCalledWith(null);
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
    component['searchForm'].selectedExternalReference().value.set('tt123');
    component['searchForm'].targetOwnerShareCode().value.set('owner-code');

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

    expect(component['searchForm'].targetOwnerShareCode().value()).toBe('owner-code');
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

    expect(component['searchForm'].targetOwnerShareCode().value()).toBe(null);
  });

  it('saves wishlist items without watched or shared library values', async () => {
    fixture.componentRef.setInput('wishlist', true);
    component['searchForm'].selectedExternalReference().value.set('tt123');
    component['searchForm'].tags().value.set('#tag');
    component['searchForm'].finished().value.set(true);
    component['searchForm'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'close', { listType: 'wishlist' });
  });

  it('saves tracking items without watched, user rate, or shared library values', async () => {
    fixture.componentRef.setInput('tracking', true);
    fixture.componentRef.setInput('allowedContentTypes', ['series', 'book']);
    component['selectedAddContentType'].set('series');
    component['searchForm'].selectedExternalReference().value.set('tt123');
    component['searchForm'].tags().value.set('#tag');
    component['searchForm'].finished().value.set(true);
    component['searchForm'].userRate().value.set(8.2);
    component['searchForm'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', null, '#tag', 'close', { listType: 'tracking' });
  });

  it('filters matched content to series in tracking mode', () => {
    fixture.componentRef.setInput('tracking', true);
    fixture.componentRef.setInput('allowedContentTypes', ['series', 'book']);
    component['selectedAddContentType'].set('series');
    service.matchedContent.set([
      { text: 'IMDb id: tt-id', value: 'tt-id' },
      { contentType: 'movie', text: 'Test Movie', value: 'tt-movie', year: '2020' },
      { contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2021' },
    ]);
    fixture.detectChanges();

    expect(component['matchedContent']()).toEqual([
      { text: 'IMDb id: tt-id', value: 'tt-id' },
      { contentType: 'series', text: 'Test Series', value: 'tt-series', year: '2021' },
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
    component['searchForm'].selectedExternalReference().value.set(matrixReference);
    await vi.advanceTimersByTimeAsync(150);
    api.collectionItemExists.mockClear();

    component['searchForm'].targetOwnerShareCode().value.set('owner-code');
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt123', 'owner-code', undefined, undefined);
  });

  it('does not check duplicate IMDb IDs when the selected value has no provider item ID', async () => {
    component['searchForm'].selectedExternalReference().value.set('tt123');
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).not.toHaveBeenCalled();
  });

  it('rechecks duplicate IMDb IDs when returning to search mode', async () => {
    api.collectionItemExists.mockReturnValue(of({ exists: true }));
    service.matchedContent.set([{ text: 'IMDb id: tt123', value: matrixReference }]);
    component['searchForm'].selectedExternalReference().value.set(matrixReference);
    await vi.advanceTimersByTimeAsync(150);
    expect(component['searchFormErrors'].selectedExternalReference.knownIMDbId()).toBe(true);

    component['onModeChange']('manual');
    await vi.advanceTimersByTimeAsync(150);
    api.collectionItemExists.mockClear();
    component['onModeChange']('search');
    expect(component['searchIMDbIdLookupPending']()).toBe(true);
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).toHaveBeenCalled();
    expect(component['searchFormErrors'].selectedExternalReference.knownIMDbId()).toBe(true);
  });

  it('exits when there is no selected IMDb id', () => {
    component['searchForm'].selectedExternalReference().value.set(null);

    component['onSave']();

    expect(service.save).not.toHaveBeenCalled();
  });

  describe('manual mode', () => {
    beforeEach(() => {
      component['onModeChange']('manual');
    });

    it('requires title and IMDb ID', () => {
      expect(component['manualForm']().valid()).toBe(false);

      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt123');

      expect(component['manualForm']().valid()).toBe(true);
    });

    it('requires a valid IMDb ID format', () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('not-an-imdb-id');

      expect(component['manualForm']().valid()).toBe(false);
      expect(component['manualFormErrors'].IMDbId.imdbId()).toBe(true);
    });

    it('validates rating formats', () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt123');
      component['manualForm'].rate().value.set('invalid');

      expect(component['manualForm']().valid()).toBe(false);
      expect(component['manualFormErrors'].rate.rateFormat()).toBe(true);
    });

    it('saves manual items through the service', async () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');
      component['manualForm'].year().value.set('2020');
      component['manualForm'].contentType().value.set('movie');
      component['manualForm'].rate().value.set('8.5');
      component['manualForm'].rottenTomatoesRate().value.set('95%');
      component['manualForm'].metacriticRate().value.set('85/100');
      component['manualForm'].userRate().value.set(9);
      component['manualForm'].image().value.set('image-url');
      component['manualForm'].genreText().value.set('Drama, Action');
      component['manualForm'].tagsText().value.set('#tag1 tag2');
      component['manualForm'].actors().value.set('Actor One, Actor Two');
      component['manualForm'].plot().value.set('Plot text');

      await component['onSave']('close');

      expect(service.saveManual).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Manual Title',
          IMDbId: 'tt1234567',
          year: '2020',
          contentType: 'movie',
          rate: '8.5',
          rottenTomatoesRate: '95%',
          metacriticRate: '85/100',
          userRate: 9,
          image: 'image-url',
          genreText: 'Drama, Action',
          tagsText: '#tag1 tag2',
          actors: 'Actor One, Actor Two',
          plot: 'Plot text',
        }),
        'close',
        {}
      );
    });

    it('defaults to series content type in tracking mode and allows type choice', async () => {
      fixture.componentRef.setInput('tracking', true);
      fixture.componentRef.setInput('allowedContentTypes', ['series', 'book']);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      expect(component['selectedAddContentType']()).toBe('series');
      expect(component['manualForm'].contentType().value()).toBe('series');
      expect(component['showCopyToTrackingCheckbox']()).toBe(false);
      expect(component['showContentTypeSelect']()).toBe(true);
    });

    it('defaults to movie content type in tracking mode when selecting movies', async () => {
      fixture.componentRef.setInput('tracking', true);
      fixture.componentRef.setInput('allowedContentTypes', ['movie', 'book']);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      expect(component['selectedAddContentType']()).toBe('movie');
      expect(component['manualForm'].contentType().value()).toBe('movie');
      expect(component['showContentTypeSelect']()).toBe(true);
    });

    it('uses the selected content type when saving a tracking item', async () => {
      fixture.componentRef.setInput('tracking', true);
      fixture.componentRef.setInput('allowedContentTypes', ['series', 'book']);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      component['manualForm'].title().value.set('Manual Series');
      component['manualForm'].IMDbId().value.set('tt1234567');
      component['selectedAddContentType'].set('series');

      await component['onSave']('close');

      expect(service.saveManual).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'series', userRate: null }),
        'close',
        { listType: 'tracking' }
      );
    });

    it('revalidates manual book progress when the sibling field recovers the range', async () => {
      fixture.componentRef.setInput('tracking', true);
      fixture.componentRef.setInput('allowedContentTypes', ['series', 'book']);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);

      component['manualForm'].title().value.set('Manual Progress Book');
      component['manualForm'].IMDbId().value.set('9780140328721');
      component['manualForm'].contentType().value.set('book');
      component['selectedAddContentType'].set('book');
      component['manualForm'].progressCurrent().value.set(150);
      component['manualForm'].progressTotal().value.set(100);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component['manualFormErrors'].progressCurrent.progressRange()).toBe(true);
      expect(component['manualForm']().valid()).toBe(false);

      component['manualForm'].progressTotal().value.set(200);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component['manualFormErrors'].progressCurrent.progressRange()).toBe(false);
      expect(component['manualFormErrors'].progressTotal.progressRange()).toBe(false);
      expect(component['manualForm']().valid()).toBe(true);
    });

    it('shows watched checkbox for manual library movies', () => {
      component['manualForm'].contentType().value.set('movie');
      expect(component['showFinishedCheckbox']()).toBe(true);
    });

    it('shows copy-to-watching checkbox for manual library series', () => {
      component['manualForm'].contentType().value.set('series');
      expect(component['showCopyToTrackingCheckbox']()).toBe(true);
    });

    it('hides manual user rate in internal list modes', () => {
      expect(component['showManualUserRate']()).toBe(true);

      fixture.componentRef.setInput('wishlist', true);

      expect(component['showManualUserRate']()).toBe(false);
    });

    it('checks canonical IMDb identities for duplicates in manual mode', async () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');
      await vi.advanceTimersByTimeAsync(150);

      expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt1234567', undefined, 'library', [
        { source: 'imdb', id: 'tt1234567' },
      ]);
    });

    it('extracts IMDb id from URL for manual duplicate checks', async () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('https://www.imdb.com/title/tt0116213');
      await vi.advanceTimersByTimeAsync(150);

      expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt0116213', undefined, 'library', [
        { source: 'imdb', id: 'tt0116213' },
      ]);
    });

    it('extracts ISBN from Open Library URL for manual book duplicate checks', async () => {
      fixture.componentRef.setInput('books', true);
      fixture.detectChanges();
      component['onModeChange']('manual');
      component['manualForm'].title().value.set('Manual Book');
      component['manualForm'].IMDbId().value.set('https://openlibrary.org/isbn/9780306406157');
      await vi.advanceTimersByTimeAsync(150);

      expect(api.collectionItemExists).toHaveBeenCalledWith('openlibrary', '9780306406157', undefined, 'books', [
        { source: 'isbn', id: '9780306406157' },
      ]);
    });

    it('keeps the manual form invalid while duplicate lookup is pending', async () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');
      await vi.advanceTimersByTimeAsync(0);

      expect(component['manualIMDbIdLookupPending']()).toBe(true);
      expect(component['manualForm']().valid()).toBe(false);

      await vi.advanceTimersByTimeAsync(150);

      expect(component['manualIMDbIdLookupPending']()).toBe(false);
      expect(component['manualForm']().valid()).toBe(true);
    });

    it('invalidates known IMDb IDs in manual mode', async () => {
      api.collectionItemExists.mockReturnValue(of({ exists: true }));
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');
      await vi.advanceTimersByTimeAsync(150);

      expect(component['manualFormErrors'].IMDbId.knownIMDbId()).toBe(true);
      expect(component['manualForm']().valid()).toBe(false);
    });

    it('ignores stale duplicate lookup responses in manual mode', async () => {
      const firstResponse = new Subject<{ exists: boolean }>();
      const secondResponse = new Subject<{ exists: boolean }>();
      api.collectionItemExists.mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse);
      component['manualForm'].IMDbId().value.set('tt1111111');
      await vi.advanceTimersByTimeAsync(150);

      component['manualForm'].IMDbId().value.set('tt2222222');
      await vi.advanceTimersByTimeAsync(0);
      firstResponse.next({ exists: true });
      expect(component['manualIMDbIdLookupPending']()).toBe(true);
      expect(component['manualFormErrors'].IMDbId.knownIMDbId()).toBe(false);

      await vi.advanceTimersByTimeAsync(150);
      secondResponse.next({ exists: false });

      expect(component['manualIMDbIdLookupPending']()).toBe(false);
      expect(component['manualFormErrors'].IMDbId.knownIMDbId()).toBe(false);
    });

    it('clears duplicate error when manual IMDb ID is invalid', async () => {
      component['manualForm'].IMDbId().value.set('invalid');
      await vi.advanceTimersByTimeAsync(150);

      expect(component['manualForm']().valid()).toBe(false);
      expect(component['manualFormErrors'].IMDbId.imdbId()).toBe(true);
    });

    it('resets manual form after save and new', async () => {
      const formRoot = component['manualForm']();
      vi.spyOn(formRoot, 'reset');
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');
      component['searchForm'].finished().value.set(true);
      component['searchForm'].copyToTrackingAsCompleted().value.set(true);

      await component['onSave']('new');

      expect(service.saveManual).toHaveBeenCalled();
      expect(formRoot.reset).toHaveBeenCalled();
      expect(component['searchForm'].finished().value()).toBe(false);
      expect(component['searchForm'].copyToTrackingAsCompleted().value()).toBe(false);
    });

    it('clears the manual IMDb ID after save', async () => {
      component['manualForm'].title().value.set('Manual Title');
      component['manualForm'].IMDbId().value.set('tt1234567');

      await component['onSave']();

      expect(component['manualForm'].title().value()).toBe('Manual Title');
      expect(component['manualForm'].IMDbId().value()).toBe('');
    });
  });
});
