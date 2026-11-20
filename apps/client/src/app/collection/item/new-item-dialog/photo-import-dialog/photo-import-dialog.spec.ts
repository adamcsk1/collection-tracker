import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PHOTO_IMPORT_MAX_BYTES, PHOTO_IMPORT_MAX_PHOTOS } from '@shared/constants/photo-import-const';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { PhotoImportRecognizeResponseModel } from '@shared/models/photo-import-model';
import { CollectionItemContentTypeModel } from '@shared/models/collection-item-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../../collection-service';
import { NewItemDialogService } from '../new-item-dialog-service';
import { PhotoImportDialog } from './photo-import-dialog';
import { PhotoImportRowModel } from './photo-import-model';
import { photoImportStateToken } from './photo-import-store';

const buildMetadata = (overrides: Partial<ExternalMetadataItemModel> = {}): ExternalMetadataItemModel => ({
  provider: 'omdb',
  providerItemId: 'tt123',
  externalIds: [{ source: 'imdb', id: 'tt123' }],
  title: 'The Matrix',
  year: '1999',
  contentType: 'movie',
  poster: '',
  plot: 'Plot',
  actors: 'Actors',
  genres: ['Action'],
  ratings: [],
  ...overrides,
});

const buildRow = (id: string, selected: ExternalMetadataItemModel | null = null): PhotoImportRowModel => ({
  id,
  photoId: 'photo',
  photoName: 'photo.jpg',
  title: id,
  details: '',
  matches: selected ? [selected] : [],
  selected,
  status: 'ready',
  searched: false,
});

describe('PhotoImportDialog', () => {
  let fixture: ComponentFixture<PhotoImportDialog>;
  let component: PhotoImportDialog;
  let api: {
    getPhotoImportAvailability: ReturnType<typeof vi.fn>;
    recognizePhoto: ReturnType<typeof vi.fn>;
    searchExternalMetadata: ReturnType<typeof vi.fn>;
    getExternalMetadataItem: ReturnType<typeof vi.fn>;
    getTagSuggestions: ReturnType<typeof vi.fn>;
    collectionItemExists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let collection: { addCollectionItem: ReturnType<typeof vi.fn>; triggerReload: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let newItem: { applySideEffects: ReturnType<typeof vi.fn> };

  const renderTemplate = async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PhotoImportDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CollectionService, useValue: collection },
        { provide: NewItemDialogService, useValue: newItem },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialApiState, apiStateToken),
      ],
    });
    fixture = TestBed.createComponent(PhotoImportDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contentType', 'movie');
    fixture.componentRef.setInput('listType', 'library');
    await fixture.whenStable();
  };

  const selectFiles = async (files: File[]) => {
    const picker = document.createElement('input');
    picker.type = 'file';
    Object.defineProperty(picker, 'files', { value: files });
    await component['onFilesSelected']({ target: picker } as unknown as Event);
    return picker;
  };

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/jpeg;base64,cGhvdG8=' });
      this.dispatchEvent(new ProgressEvent('load'));
    });
    api = {
      getPhotoImportAvailability: vi.fn(() => of({ available: true, reason: 'available' })),
      recognizePhoto: vi.fn(() => of({ titles: [{ title: 'The Matrix', contributor: 'Wachowski', year: '1999' }] })),
      searchExternalMetadata: vi.fn(() => of({ results: [buildMetadata()] })),
      getExternalMetadataItem: vi.fn(() => of(buildMetadata())),
      getTagSuggestions: vi.fn(() => of({ tags: [] })),
      collectionItemExists: vi.fn(() => of({ exists: false })),
      create: vi.fn(() => of({ item: { title: 'The Matrix', id: 1 } })),
    };
    collection = { addCollectionItem: vi.fn(), triggerReload: vi.fn() };
    newItem = {
      applySideEffects: vi.fn(({ collectionItem }: Parameters<NewItemDialogService['applySideEffects']>[0]) =>
        of({ collectionItem, finishedItem: null, trackingItem: null, trackerUpdateFailed: false })
      ),
    };
    confirm = { open: vi.fn(() => of(false)) };
    TestBed.configureTestingModule({
      imports: [PhotoImportDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CollectionService, useValue: collection },
        { provide: NewItemDialogService, useValue: newItem },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideStore(initialApiState, apiStateToken),
      ],
    });
    TestBed.overrideComponent(PhotoImportDialog, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(PhotoImportDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contentType', 'movie');
    fixture.componentRef.setInput('listType', 'library');
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retains ISBN discovery aliases through work lookup, duplicate check, and creation', async () => {
    fixture.componentRef.setInput('contentType', 'book');
    fixture.componentRef.setInput('listType', 'books');
    const work = buildMetadata({
      provider: 'openlibrary',
      providerItemId: 'OL1W',
      contentType: 'book',
      externalIds: [{ source: 'openlibrary', id: 'OL1W' }],
    });
    const aliases = [...work.externalIds!, { source: 'isbn' as const, id: '9780306406157' }];
    component['store'].setState('rows', [buildRow('book', { ...work, externalIds: aliases })]);
    api.getExternalMetadataItem.mockReturnValue(of(work));
    await component['addSelected']();
    expect(api.collectionItemExists).toHaveBeenCalledWith('openlibrary', 'OL1W', undefined, 'books', aliases, {
      suppressErrorAlert: true,
    });
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalItemId: 'OL1W', externalIds: aliases }),
      undefined,
      'books',
      { suppressErrorAlert: true }
    );
  });

  it('debounces query edits for 500 ms and searches only the latest trimmed value', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    api.searchExternalMetadata.mockClear();
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['New'] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    component['searchModel'].set({ queries: ['  New title  '] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(499);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
      { s: 'New title', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.searchExternalMetadata).toHaveBeenCalledOnce();
  });

  it('preserves selection for whitespace-only edits and clears stale matches for empty queries', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    component['onSelect'](0, buildMetadata());
    api.searchExternalMetadata.mockClear();
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['  The Matrix  '] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    expect(component['state'].rows()[0].selected).toEqual(buildMetadata());
    component['searchModel'].set({ queries: ['   '] });
    fixture.detectChanges();
    expect(component['state'].rows()[0]).toMatchObject({ selected: null, matches: [], searched: false });
    expect(component['selectedCount']()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
  });

  it('clears selection immediately while a changed query is waiting for debounce', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    component['onSelect'](0, buildMetadata());
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['Changed title'] });
    fixture.detectChanges();
    expect(component['selectedCount']()).toBe(0);
    expect(component['state'].rows()[0]).toMatchObject({ selected: null, matches: [], searched: false });
  });

  it('searches edits in multiple rows without dropping a query while another search is busy', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'First' }, { title: 'Second' }] }));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    api.searchExternalMetadata.mockClear();
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['New first', 'New second'] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    expect(api.searchExternalMetadata.mock.calls.map(([query]) => query.s)).toEqual(['New first', 'New second']);
  });

  it.each(['success', 'error'])('ignores a stale search %s after the query changes', async (result) => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    const stale = new Subject<{ results: ExternalMetadataItemModel[] }>();
    api.searchExternalMetadata.mockReturnValueOnce(stale);
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['Old edit'] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    component['searchModel'].set({ queries: ['Latest edit'] });
    fixture.detectChanges();
    if (result === 'success') stale.next({ results: [buildMetadata({ title: 'Stale result' })] });
    else stale.error(new Error('Stale failure'));
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(component['state'].rows()[0]).toMatchObject({ status: 'ready', matches: [], selected: null });
    await vi.advanceTimersByTimeAsync(500);
    expect(api.searchExternalMetadata).toHaveBeenLastCalledWith(
      { s: 'Latest edit', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0].matches).toEqual([buildMetadata()]);
  });

  it('cancels a pending debounced search on destruction', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    api.searchExternalMetadata.mockClear();
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['New title'] });
    fixture.detectChanges();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(500);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
  });

  it('stops queued row searches after the current request finishes', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'First' }, { title: 'Second' }] }));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    const response = new Subject<{ results: ExternalMetadataItemModel[] }>();
    api.searchExternalMetadata.mockClear().mockReturnValueOnce(response);
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['New first', 'New second'] });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    component['requestStop']();
    response.next({ results: [] });
    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(api.searchExternalMetadata).toHaveBeenCalledOnce();
  });

  it('shows Retry only for failed searches and retries the same value without another edit', async () => {
    await renderTemplate();
    api.searchExternalMetadata.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-test-id="photo-import-search-button"]')).toBeNull();
    const retry = host.querySelector<HTMLButtonElement>('[data-test-id="photo-import-retry-search"]');
    expect(retry?.textContent).toContain('PhotoImport.RetrySearch');
    retry!.click();
    await fixture.whenStable();
    expect(api.searchExternalMetadata).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-test-id="photo-import-retry-search"]')).toBeNull();
  });

  it('searches a restored row when it was skipped before its debounce elapsed', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    api.searchExternalMetadata.mockClear();
    vi.useFakeTimers();
    component['searchModel'].set({ queries: ['New title'] });
    fixture.detectChanges();
    component['onSkip'](0);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    component['onSkip'](0);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
      { s: 'New title', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0]).toMatchObject({ status: 'ready', matches: [buildMetadata()] });
  });

  it('retries a failed search when its row is restored without changing the query', async () => {
    api.searchExternalMetadata.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    component['onSkip'](0);
    component['onSkip'](0);
    await fixture.whenStable();
    expect(api.searchExternalMetadata).toHaveBeenCalledTimes(2);
    expect(component['state'].rows()[0]).toMatchObject({ status: 'ready', matches: [buildMetadata()] });
  });

  it('offers Resume search for recognized rows left unsearched after Stop', async () => {
    await renderTemplate();
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'First' }, { title: 'Second' }] }));
    const response = new Subject<{ results: ExternalMetadataItemModel[] }>();
    api.searchExternalMetadata.mockReturnValueOnce(response);
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    const reading = component['readPhotos']();
    await vi.waitFor(() => expect(api.searchExternalMetadata).toHaveBeenCalledOnce());
    component['requestStop']();
    response.next({ results: [buildMetadata()] });
    await reading;
    await fixture.whenStable();
    const resume = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-test-id="photo-import-retry-search"]'
    );
    expect(resume?.textContent).toContain('PhotoImport.ResumeSearch');
    resume!.click();
    await fixture.whenStable();
    expect(api.searchExternalMetadata).toHaveBeenLastCalledWith(
      { s: 'Second', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[1]).toMatchObject({ searched: true, matches: [buildMetadata()] });
  });

  it('resumes title fallback when Stop interrupted an unmatched identifier lookup', async () => {
    await renderTemplate();
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix', identifier: 'tt0133093' }] }));
    const lookup = new Subject<ExternalMetadataItemModel>();
    api.getExternalMetadataItem
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    const reading = component['readPhotos']();
    await vi.waitFor(() => expect(api.getExternalMetadataItem).toHaveBeenCalledOnce());
    component['requestStop']();
    lookup.error(new HttpErrorResponse({ status: 404 }));
    await reading;
    await fixture.whenStable();
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    const resume = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-test-id="photo-import-retry-search"]'
    );
    expect(resume?.textContent).toContain('PhotoImport.ResumeSearch');
    resume!.click();
    await fixture.whenStable();
    expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
      { s: 'The Matrix', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0]).toMatchObject({ searched: true, matches: [buildMetadata()] });
  });

  it.each<[CollectionItemContentTypeModel, ExternalMetadataProviderNameModel, string]>([
    ['movie', 'omdb', 'tt0133093'],
    ['series', 'omdb', 'tt0944947'],
    ['book', 'openlibrary', '9780441172719'],
    ['album', 'musicbrainz', '6d6e2b1b-5e60-4a85-8d69-e9d513ec2b00'],
  ])(
    'looks up identifier-only %s photos exactly and still requires selection',
    async (contentType, provider, identifier) => {
      fixture.componentRef.setInput('contentType', contentType);
      const metadata = buildMetadata({ contentType, provider, providerItemId: identifier });
      api.recognizePhoto.mockReturnValue(of({ titles: [{ title: '', identifier, year: null, contributor: null }] }));
      api.getExternalMetadataItem.mockReturnValue(of(metadata));
      await selectFiles([new File(['photo'], 'identifier.jpg', { type: 'image/jpeg' })]);
      await component['readPhotos']();

      expect(api.getExternalMetadataItem).toHaveBeenCalledExactlyOnceWith(
        { externalIdentitySource: provider === 'omdb' ? 'imdb' : provider, externalIdentityId: identifier },
        { suppressErrorAlert: true }
      );
      expect(api.searchExternalMetadata).not.toHaveBeenCalled();
      expect(component['state'].rows()[0]).toMatchObject({ title: identifier, matches: [metadata], selected: null });
      expect(component['searchModel']().queries).toEqual([identifier]);
      expect(api.create).not.toHaveBeenCalled();
    }
  );

  it('searches printed music barcode digits before a visible title', async () => {
    fixture.componentRef.setInput('contentType', 'album');
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'Album', identifier: '012345678905' }] }));
    api.searchExternalMetadata.mockReturnValue(of({ results: [buildMetadata({ contentType: 'album' })] }));
    await selectFiles([new File(['photo'], 'barcode.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
      { s: '012345678905', provider: 'musicbrainz' },
      { suppressErrorAlert: true }
    );
    expect(api.getExternalMetadataItem).not.toHaveBeenCalled();
  });

  it.each(['not-found', 'wrong-media'])(
    'falls back to the visible title when identifier lookup returns %s',
    async (failure) => {
      api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix', identifier: 'tt0133093' }] }));
      api.getExternalMetadataItem.mockReturnValue(
        failure === 'not-found'
          ? throwError(() => new HttpErrorResponse({ status: 404 }))
          : of(buildMetadata({ contentType: 'series' }))
      );
      await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
      await component['readPhotos']();
      expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
        { s: 'The Matrix', provider: 'omdb' },
        { suppressErrorAlert: true }
      );
      expect(component['searchModel']().queries).toEqual(['The Matrix']);
      expect(component['state'].rows()[0]).toMatchObject({ status: 'ready', matches: [buildMetadata()] });
    }
  );

  it('keeps identifier lookup failures retryable without hiding provider outages behind title search', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix', identifier: 'tt0133093' }] }));
    api.getExternalMetadataItem.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(component['state'].rows()[0].status).toBe('error');
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    expect(component['searchModel']().queries).toEqual(['tt0133093']);
    api.getExternalMetadataItem.mockReturnValue(of(buildMetadata()));
    await component['onSearchRow'](0);
    expect(component['state'].rows()[0].status).toBe('ready');
  });

  it('falls back to the album title after an empty barcode search', async () => {
    fixture.componentRef.setInput('contentType', 'album');
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'Album', identifier: '012345678905' }] }));
    const metadata = buildMetadata({ contentType: 'album' });
    api.searchExternalMetadata
      .mockReturnValueOnce(of({ results: [] }))
      .mockReturnValueOnce(of({ results: [metadata] }));
    await selectFiles([new File(['photo'], 'barcode.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(api.searchExternalMetadata).toHaveBeenNthCalledWith(
      1,
      { s: '012345678905', provider: 'musicbrainz' },
      { suppressErrorAlert: true }
    );
    expect(api.searchExternalMetadata).toHaveBeenNthCalledWith(
      2,
      { s: 'Album', provider: 'musicbrainz' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0].matches).toEqual([metadata]);
  });

  it('leaves unmatched identifier-only rows editable without an empty title search', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: '', identifier: 'tt0133093' }] }));
    api.getExternalMetadataItem.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await selectFiles([new File(['photo'], 'identifier.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(component['state'].rows()[0]).toMatchObject({
      status: 'ready',
      searched: true,
      matches: [],
      selected: null,
    });
    expect(component['searchModel']().queries).toEqual(['tt0133093']);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
  });

  it('allows a manually corrected identifier after title recognition', async () => {
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    component['searchModel'].set({ queries: ['tt0133093'] });
    await component['onSearchRow'](0);
    expect(api.getExternalMetadataItem).toHaveBeenCalledExactlyOnceWith(
      { externalIdentitySource: 'imdb', externalIdentityId: 'tt0133093' },
      { suppressErrorAlert: true }
    );
  });

  it('retains title fallback when retrying a recognized identifier after an outage', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix', identifier: 'tt0133093' }] }));
    api.getExternalMetadataItem
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    component['requestStop']();
    await component['onSearchRow'](0);
    expect(api.searchExternalMetadata).toHaveBeenCalledExactlyOnceWith(
      { s: 'The Matrix', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0]).toMatchObject({ status: 'ready', matches: [buildMetadata()] });
  });

  it('does not replace a manually changed identifier with the original recognized title', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix', identifier: 'tt0133093' }] }));
    await selectFiles([new File(['photo'], 'cover.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    component['searchModel'].set({ queries: ['tt0944947'] });
    api.getExternalMetadataItem.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await component['onSearchRow'](0);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    expect(component['searchModel']().queries).toEqual(['tt0944947']);
  });

  it('provides isolated dialog state and checks vision availability on initialization', () => {
    expect(fixture.nativeElement.classList.contains('dialog')).toBe(false);
    expect(fixture.debugElement.injector.get(photoImportStateToken).state.photos()).toEqual([]);
    expect(api.getPhotoImportAvailability).toHaveBeenCalledOnce();
    expect(component['state'].availability()).toEqual({ available: true, reason: 'available' });
  });

  it('renders an embedded workflow and shared review cards, exposing actions for the parent footer', async () => {
    await renderTemplate();
    const element: HTMLElement = fixture.nativeElement;
    const control = (id: string) => element.querySelector(`[data-test-id="photo-import-${id}"]`);
    expect(element.querySelector('libc-dialog-shell')).toBeNull();
    expect(control('done')).toBeNull();
    expect(component.actions()).toBeDefined();
    expect(control('files')?.hasAttribute('hidden')).toBe(true);
    expect(control('add')).toBeNull();
    expect(control('read')).toBeNull();
    expect(control('unavailable')).toBeNull();
    expect(component['translations'].availability()).toBe('');
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await fixture.whenStable();
    expect(component.batchStarted()).toBe(true);
    expect(component.hasUnfinishedWork()).toBe(true);
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('busy', true);
    await fixture.whenStable();
    expect(component.busy()).toBe(true);
    store.setState('busy', false);
    await component['readPhotos']();
    await fixture.whenStable();
    expect(component['selectedCount']()).toBe(0);
    expect(element.querySelector('ct-metadata-results')).not.toBeNull();
    expect(element.querySelector('input[type="radio"]')).toBeNull();
    expect(control('option')?.getAttribute('aria-pressed')).toBe('false');
    const searchInput = control('search')?.querySelector('input');
    const hintId = searchInput?.getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    expect(element.querySelector(`[id="${hintId}"]`)?.textContent).toBe('PhotoImport.SearchHint');
    store.setState(
      'rows',
      component['state'].rows().map((row) => ({ ...row, status: 'error' }))
    );
    await fixture.whenStable();
    expect(element.querySelector(`[id="${hintId}"]`)?.textContent).toBe('PhotoImport.SearchError');
    control('option')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(component['selectedCount']()).toBe(1);
    expect(control('option')?.getAttribute('aria-pressed')).toBe('true');
    store.setState('availability', { available: false, reason: 'not-configured' });
    await fixture.whenStable();
    expect(control('unavailable')?.textContent).toContain('PhotoImport.Availability.NotConfigured');
  });

  it.each([
    ['movie', 'photo-import-finished'],
    ['series', 'photo-import-copy-to-tracking-as-completed'],
    ['book', null],
    ['album', null],
  ] as const)('renders only the applicable tracking option for selected %s rows', async (contentType, testId) => {
    await renderTemplate();
    fixture.componentRef.setInput('contentType', contentType);
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [buildRow('selected', buildMetadata({ contentType }))]);
    component['searchModel'].set({ queries: ['Selected'] });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const options = () => element.querySelectorAll('libc-checkbox');
    expect(component.trackingEnabled()).toBe(false);
    expect(options()).toHaveLength(0);
    fixture.componentRef.setInput('trackingEnabled', true);
    await fixture.whenStable();
    expect(options()).toHaveLength(testId ? 1 : 0);
    if (testId) {
      const checkbox = element.querySelector<HTMLInputElement>(`[data-test-id="${testId}"] input`)!;
      expect(checkbox.checked).toBe(false);
      expect(checkbox.disabled).toBe(false);
      checkbox.click();
      await fixture.whenStable();
      expect(component['state'].rows()[0]).toEqual(
        expect.objectContaining(contentType === 'movie' ? { finished: true } : { copyToTrackingAsCompleted: true })
      );
      store.setState('busy', true);
      await fixture.whenStable();
      expect(checkbox.disabled).toBe(true);
    }
  });

  it('keeps row options independent and hides them after skip until explicitly reselected', async () => {
    await renderTemplate();
    fixture.componentRef.setInput('trackingEnabled', true);
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    const metadata = buildMetadata();
    store.setState('rows', [
      buildRow('first', metadata),
      buildRow('second', buildMetadata({ providerItemId: 'tt456' })),
      buildRow('unselected'),
      { ...buildRow('added', buildMetadata({ providerItemId: 'tt-added' })), status: 'added' },
      { ...buildRow('exists', buildMetadata({ providerItemId: 'tt-exists' })), status: 'exists' },
      { ...buildRow('error', buildMetadata({ providerItemId: 'tt-error' })), status: 'error' },
    ]);
    component['searchModel'].set({ queries: ['First', 'Second', 'Unselected', 'Added', 'Exists', 'Error'] });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const options = () => element.querySelectorAll<HTMLInputElement>('[data-test-id="photo-import-finished"] input');
    expect(options()).toHaveLength(3);
    options()[0]!.click();
    await fixture.whenStable();
    expect(options()[0]!.checked).toBe(true);
    expect(options()[1]!.checked).toBe(false);
    expect(component['state'].rows()[0]!.finished).toBe(true);
    expect(component['state'].rows()[1]!.finished).toBeUndefined();
    component['onSkip'](0);
    await fixture.whenStable();
    expect(options()).toHaveLength(2);
    component['onSkip'](0);
    await fixture.whenStable();
    expect(options()).toHaveLength(2);
    component['onSelect'](0, metadata);
    await fixture.whenStable();
    expect(options()).toHaveLength(3);
    expect(options()[0]!.checked).toBe(true);
    component['onTrackingOptionChange'](0, 'finished', null);
    await fixture.whenStable();
    expect(options()[0]!.checked).toBe(false);
    fixture.componentRef.setInput('trackingEnabled', false);
    await fixture.whenStable();
    expect(options()).toHaveLength(0);
  });

  it.each([
    ['tracking', 'movie'],
    ['wishlist', 'series'],
    ['up-next', 'movie'],
    ['books', 'book'],
    ['music', 'album'],
  ] as const)(
    'hides tracking options and ignores stored choices in the %s destination',
    async (listType, contentType) => {
      await renderTemplate();
      fixture.componentRef.setInput('trackingEnabled', true);
      fixture.componentRef.setInput('listType', listType);
      fixture.componentRef.setInput('contentType', contentType);
      api.getExternalMetadataItem.mockReturnValue(of(buildMetadata({ contentType })));
      const store = fixture.debugElement.injector.get(photoImportStateToken);
      const row = {
        ...buildRow('row', buildMetadata({ contentType })),
        finished: true,
        copyToTrackingAsCompleted: true,
      };
      store.setState('rows', [row]);
      component['searchModel'].set({ queries: ['The Matrix'] });
      component['detailsModel'].set({ row: { tags: '  custom\t#favorite  ', userRate: 11.25 } });
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('libc-checkbox')).toBeNull();
      expect(element.querySelector('[data-test-id="photo-import-tags"]')).not.toBeNull();
      expect(element.querySelector('[data-test-id="photo-import-user-rate"]')).toBeNull();
      expect(component['detailsForm']['row']!.userRate().disabled()).toBe(true);
      component['onTrackingOptionChange'](0, 'finished', false);
      expect(component['state'].rows()[0]).toEqual(row);
      await component['addSelected']();
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['custom', '#favorite'], userRate: null }),
        undefined,
        listType,
        { suppressErrorAlert: true }
      );
      expect(newItem.applySideEffects).toHaveBeenCalledWith(
        expect.objectContaining({ listType, finished: false, copyToTrackingAsCompleted: false })
      );
    }
  );

  it('ignores tracking option changes while busy, disabled, or terminal', () => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    const row = buildRow('row', buildMetadata());
    store.setState('rows', [row]);
    component['onTrackingOptionChange'](0, 'finished', true);
    expect(component['state'].rows()[0]).toEqual(row);
    fixture.componentRef.setInput('trackingEnabled', true);
    store.setState('busy', true);
    component['onTrackingOptionChange'](0, 'finished', true);
    expect(component['state'].rows()[0]).toEqual(row);
    store.setState('busy', false);
    for (const status of ['adding', 'added', 'exists', 'skipped'] as const) {
      store.setState('rows', [{ ...row, status }]);
      component['onTrackingOptionChange'](0, 'finished', true);
      expect(component['state'].rows()[0]).toEqual({ ...row, status });
    }
    component['onTrackingOptionChange'](10, 'finished', true);
    expect(component['state'].rows()).toHaveLength(1);
  });

  it('initializes independent details drafts and renders controls only for selected ready or failed rows', async () => {
    await renderTemplate();
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'First' }, { title: 'Second' }] }));
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    await fixture.whenStable();
    const [first, second] = component['state'].rows();
    expect(component['detailsModel']()).toEqual({
      [first!.id]: { tags: '', userRate: null },
      [second!.id]: { tags: '', userRate: null },
    });
    const element: HTMLElement = fixture.nativeElement;
    const controls = (name: string) => element.querySelectorAll(`[data-test-id="photo-import-${name}"] input`);
    expect(controls('tags')).toHaveLength(0);
    expect(controls('user-rate')).toHaveLength(0);
    component['onSelect'](0, buildMetadata());
    component['onSelect'](1, buildMetadata({ providerItemId: 'tt456' }));
    await fixture.whenStable();
    expect(controls('tags')).toHaveLength(2);
    expect(controls('user-rate')).toHaveLength(2);
    const tags = controls('tags')[0] as HTMLInputElement;
    const rating = controls('user-rate')[0] as HTMLInputElement;
    tags.value = 'custom #favorite';
    tags.dispatchEvent(new Event('input', { bubbles: true }));
    rating.value = '8.5';
    rating.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(component['detailsModel']()[first!.id]).toEqual({ tags: 'custom #favorite', userRate: 8.5 });
    expect(component['detailsModel']()[second!.id]).toEqual({ tags: '', userRate: null });
    expect(rating.step).toBe('0.1');
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('busy', true);
    await fixture.whenStable();
    expect(tags.disabled).toBe(true);
    expect(rating.disabled).toBe(true);
    store.setState('busy', false);
    await fixture.whenStable();
    expect(tags.disabled).toBe(false);
    expect(rating.disabled).toBe(false);
    rating.value = '8.25';
    rating.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('[data-test-id="photo-import-user-rate"]')?.textContent).toContain(
      'Validation.UserRate'
    );
    expect(component['selectedCount']()).toBe(1);
    rating.value = '';
    rating.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(component['detailsModel']()[first!.id]!.userRate).toBeNull();
    expect(component['selectedCount']()).toBe(2);
    for (const status of ['error', 'searching', 'adding', 'added', 'exists', 'skipped'] as const) {
      store.setState('rows', [{ ...first!, selected: buildMetadata(), status }]);
      await fixture.whenStable();
      expect(controls('tags')).toHaveLength(status === 'error' ? 1 : 0);
      expect(controls('user-rate')).toHaveLength(status === 'error' ? 1 : 0);
    }
  });

  it.each([
    [null, true],
    [0, true],
    [10, true],
    [8.1, true],
    [-0.1, false],
    [10.1, false],
    [8.25, false],
  ] as const)('validates library rating %s before adding a row', async (userRate, valid) => {
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    const row = component['state'].rows()[0]!;
    component['onSelect'](0, buildMetadata());
    component['detailsForm'][row.id]!.userRate().value.set(userRate);
    expect(component['detailsForm'][row.id]!.userRate().invalid()).toBe(!valid);
    expect(component['selectedCount']()).toBe(valid ? 1 : 0);
    await component['addSelected']();
    if (valid) {
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ tags: [], userRate }), undefined, 'library', {
        suppressErrorAlert: true,
      });
    } else {
      expect(api.getExternalMetadataItem).not.toHaveBeenCalled();
      expect(api.create).not.toHaveBeenCalled();
      expect(component['state'].rows()[0]!.status).toBe('ready');
    }
  });

  it('excludes invalid drafts from a mixed batch before busy disables validation', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'Invalid' }, { title: 'Valid' }] }));
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    const [invalid, valid] = component['state'].rows();
    component['onSelect'](0, buildMetadata({ providerItemId: 'tt-invalid' }));
    component['onSelect'](1, buildMetadata({ providerItemId: 'tt-valid' }));
    component['detailsModel'].set({
      [invalid!.id]: { tags: 'invalid', userRate: 10.5 },
      [valid!.id]: { tags: '  custom\t#favorite\nother  ', userRate: 9.5 },
    });
    const pending = new Subject<ExternalMetadataItemModel>();
    api.getExternalMetadataItem.mockReturnValue(pending);
    expect(component['selectedCount']()).toBe(1);
    const adding = component['addSelected']();
    expect(component.busy()).toBe(true);
    expect(component['detailsForm'][invalid!.id]!.userRate().disabled()).toBe(true);
    expect(component['detailsForm'][invalid!.id]!().invalid()).toBe(false);
    expect(api.getExternalMetadataItem).toHaveBeenCalledExactlyOnceWith(
      { externalIdentitySource: 'omdb', externalIdentityId: 'tt-valid' },
      { suppressErrorAlert: true }
    );
    pending.next(buildMetadata({ providerItemId: 'tt-valid' }));
    await adding;
    expect(api.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ tags: ['custom', '#favorite', 'other'], userRate: 9.5 }),
      undefined,
      'library',
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows().map((row) => row.status)).toEqual(['ready', 'added']);
    expect(component['detailsForm'][invalid!.id]!().invalid()).toBe(true);
    expect(component['selectedCount']()).toBe(0);
  });

  it('preserves details through photo retry, corrected search, skip, and failed create retry', async () => {
    api.recognizePhoto
      .mockReturnValueOnce(of({ titles: [{ title: 'First' }] }))
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ titles: [{ title: 'Second' }] }));
    await selectFiles([
      new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ]);
    await component['readPhotos']();
    const first = component['state'].rows()[0]!;
    const draft = { tags: 'custom #favorite', userRate: 7.5 };
    component['detailsModel'].update((details) => ({ ...details, [first.id]: draft }));
    await component['readPhotos']();
    const second = component['state'].rows()[1]!;
    expect(component['detailsModel']()).toEqual({
      [first.id]: draft,
      [second.id]: { tags: '', userRate: null },
    });
    component['onSelect'](0, buildMetadata());
    component['searchForm'].queries[0]!().value.set('Corrected');
    await component['onSearchRow'](0);
    expect(component['state'].rows()[0]!.selected).toBeNull();
    expect(component['detailsModel']()[first.id]).toEqual(draft);
    component['onSelect'](0, buildMetadata());
    component['onSkip'](0);
    component['onSkip'](0);
    expect(component['detailsModel']()[first.id]).toEqual(draft);
    component['onSelect'](0, buildMetadata());
    api.create.mockReturnValueOnce(throwError(() => new Error('offline')));
    await component['addSelected']();
    expect(component['state'].rows()[0]!.status).toBe('error');
    expect(component['detailsModel']()[first.id]).toEqual(draft);
    await component['addSelected']();
    expect(api.create).toHaveBeenCalledTimes(2);
    for (const [payload] of api.create.mock.calls) {
      expect(payload).toEqual(expect.objectContaining({ tags: ['custom', '#favorite'], userRate: 7.5 }));
    }
    expect(component['state'].rows()[0]!.status).toBe('added');
  });

  it('turns availability failures into an unavailable state without processing photos', async () => {
    api.getPhotoImportAvailability.mockReturnValue(throwError(() => new Error('offline')));
    await component['checkAvailability']();
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(component['state'].availability()).toEqual({ available: false, reason: 'unreachable' });
    expect(api.recognizePhoto).not.toHaveBeenCalled();
  });

  it.each([
    ['not-configured', 'NotConfigured'],
    ['invalid-config', 'InvalidConfig'],
    ['unreachable', 'Unreachable'],
    ['unsupported-model', 'UnsupportedModel'],
  ] as const)('shows the translated %s guidance inside the photo tab', (reason, key) => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('availability', null);
    expect(component['translations'].availability()).toBe('PhotoImport.Checking');
    store.setState('availability', { available: false, reason });
    expect(component['translations'].availability()).toBe(`PhotoImport.Availability.${key}`);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'accepts %s and releases its preview on destruction',
    async (type) => {
      const file = new File(['photo'], 'photo', { type });
      const picker = await selectFiles([file]);
      expect(component['state'].photos()).toEqual([
        expect.objectContaining({ file, preview: 'blob:photo', status: 'ready' }),
      ]);
      expect(picker.value).toBe('');
      fixture.destroy();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    }
  );

  it.each(['unsupported', 'empty', 'oversized', 'too-many'] as const)(
    'rejects the whole %s batch before creating previews',
    async (reason) => {
      const file = new File(reason === 'empty' ? [] : ['photo'], 'photo', {
        type: reason === 'unsupported' ? 'image/gif' : 'image/jpeg',
      });
      if (reason === 'oversized') Object.defineProperty(file, 'size', { value: PHOTO_IMPORT_MAX_BYTES + 1 });
      await selectFiles(Array.from({ length: reason === 'too-many' ? PHOTO_IMPORT_MAX_PHOTOS + 1 : 1 }, () => file));
      expect(component['state'].invalidPhotos()).toBe(true);
      expect(component['state'].photos()).toEqual([]);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    }
  );

  it('accepts the size and count limits and ignores replacement batches', async () => {
    const file = new File(['photo'], 'photo', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: PHOTO_IMPORT_MAX_BYTES });
    await selectFiles(Array.from({ length: PHOTO_IMPORT_MAX_PHOTOS }, () => file));
    await selectFiles([new File(['next'], 'next.png', { type: 'image/png' })]);
    expect(component['state'].photos()).toHaveLength(PHOTO_IMPORT_MAX_PHOTOS);
    expect(component['state'].invalidPhotos()).toBe(false);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(PHOTO_IMPORT_MAX_PHOTOS);
  });

  it('recognizes multiple titles as separate rows, filters suggestions, and requires explicit selection', async () => {
    api.recognizePhoto.mockReturnValue(of({ titles: [{ title: 'The Matrix' }, { title: 'Matrix Reloaded' }] }));
    api.searchExternalMetadata.mockReturnValue(
      of({ results: [buildMetadata(), buildMetadata({ contentType: 'series' })] })
    );
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(api.recognizePhoto).toHaveBeenCalledWith({ contentType: 'movie', imageBase64: 'cGhvdG8=' });
    expect(api.searchExternalMetadata).toHaveBeenNthCalledWith(
      1,
      { s: 'The Matrix', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(api.searchExternalMetadata).toHaveBeenNthCalledWith(
      2,
      { s: 'Matrix Reloaded', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()).toHaveLength(2);
    expect(component['state'].rows().every((row) => row.matches.length === 1 && !row.selected)).toBe(true);
    expect(component['selectedCount']()).toBe(0);
    await component['addSelected']();
    expect(api.create).not.toHaveBeenCalled();
    component['onSelect'](0, component['state'].rows()[0]!.matches[0]!);
    expect(component['selectedCount']()).toBe(1);
  });

  it('retries failed photos without recognizing successful photos or duplicating their rows', async () => {
    api.recognizePhoto
      .mockReturnValueOnce(of({ titles: [{ title: 'First' }] }))
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ titles: [{ title: 'Second' }] }));
    await selectFiles([
      new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ]);
    await component['readPhotos']();
    expect(component['state'].photos().map((photo) => photo.status)).toEqual(['recognized', 'error']);
    await component['readPhotos']();
    expect(api.recognizePhoto).toHaveBeenCalledTimes(3);
    expect(component['state'].rows().map((row) => row.title)).toEqual(['First', 'Second']);
    expect(component['state'].busy()).toBe(false);
  });

  it('keeps unreadable photos retryable without sending invalid base64', async () => {
    vi.mocked(FileReader.prototype.readAsDataURL).mockImplementationOnce(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(api.recognizePhoto).not.toHaveBeenCalled();
    expect(component['state'].photos()[0]!.status).toBe('error');
    await component['readPhotos']();
    expect(api.recognizePhoto).toHaveBeenCalledOnce();
    expect(component['state'].photos()[0]!.status).toBe('recognized');
  });

  it('retries metadata search independently without recognizing a successful photo again', async () => {
    api.searchExternalMetadata.mockReturnValueOnce(throwError(() => new Error('provider offline')));
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    await component['readPhotos']();
    expect(component['state'].photos()[0]!.status).toBe('recognized');
    expect(component['state'].rows()[0]!.status).toBe('error');
    await component['onSearchRow'](0);
    await component['readPhotos']();
    expect(api.recognizePhoto).toHaveBeenCalledOnce();
    expect(api.searchExternalMetadata).toHaveBeenCalledTimes(2);
    expect(component['state'].rows()[0]).toEqual(expect.objectContaining({ status: 'ready', searched: true }));
  });

  it('stops after the current recognition request and leaves later photos pending', async () => {
    const pending = new Subject<PhotoImportRecognizeResponseModel>();
    api.recognizePhoto.mockReturnValue(pending);
    await selectFiles([
      new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ]);
    const reading = component['readPhotos']();
    await vi.waitFor(() => expect(api.recognizePhoto).toHaveBeenCalledOnce());
    expect(await component['canClose']()).toBe(false);
    expect(confirm.open).not.toHaveBeenCalled();
    component['requestStop']();
    pending.next({ titles: [{ title: 'First', year: null, contributor: null }] });
    await reading;
    expect(api.recognizePhoto).toHaveBeenCalledOnce();
    expect(component['state'].photos().map((photo) => photo.status)).toEqual(['recognized', 'ready']);
    expect(component['state'].busy()).toBe(false);
  });

  it.each([
    ['book', 'openlibrary'],
    ['album', 'musicbrainz'],
    ['series', 'omdb'],
  ] as const)(
    'searches corrected %s queries through %s and clears the previous selection',
    async (contentType, provider) => {
      fixture.componentRef.setInput('contentType', contentType);
      const store = fixture.debugElement.injector.get(photoImportStateToken);
      store.setState('rows', [buildRow('row', buildMetadata({ contentType }))]);
      component['searchModel'].set({ queries: ['Mistaken title'] });
      component['searchForm'].queries[0]!().value.set('  Corrected title  ');
      await component['onSearchRow'](0);
      expect(api.searchExternalMetadata).toHaveBeenCalledWith(
        { s: 'Corrected title', provider },
        { suppressErrorAlert: true }
      );
      expect(component['state'].rows()[0]!.selected).toBeNull();
      expect(component['state'].rows()[0]!.searched).toBe(true);
    }
  );

  it('skips and restores a row without preserving an implicit selection', () => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [buildRow('row', buildMetadata())]);
    component['onSkip'](0);
    expect(component['state'].rows()[0]).toEqual(expect.objectContaining({ status: 'skipped', selected: null }));
    expect(component['selectedCount']()).toBe(0);
    component['onSkip'](0);
    expect(component['state'].rows()[0]).toEqual(expect.objectContaining({ status: 'ready', selected: null }));
  });

  it('disables query fields during recognition without losing corrected or newly recognized queries', async () => {
    const recognition = new Subject<PhotoImportRecognizeResponseModel>();
    const search = new Subject<{ results: ExternalMetadataItemModel[] }>();
    api.recognizePhoto.mockReturnValue(recognition);
    api.searchExternalMetadata.mockReturnValueOnce(search);
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('existing')]);
    component['searchModel'].set({ queries: ['Mistaken title'] });
    component['searchForm'].queries[0]!().value.set('  Corrected title  ');
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);

    const reading = component['readPhotos']();
    expect(component['searchForm'].queries[0]!().disabled()).toBe(true);
    expect(component['searchForm'].queries[0]!().value()).toBe('  Corrected title  ');
    await vi.waitFor(() => expect(api.recognizePhoto).toHaveBeenCalledOnce());
    recognition.next({ titles: [{ title: 'New title', year: null, contributor: null }] });
    await vi.waitFor(() => expect(api.searchExternalMetadata).toHaveBeenCalledOnce());
    expect(component['searchModel']().queries).toEqual(['  Corrected title  ', 'New title']);
    expect(component['searchForm'].queries[1]!().disabled()).toBe(true);
    expect(api.searchExternalMetadata).toHaveBeenCalledWith(
      { s: 'New title', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
    search.next({ results: [] });
    await reading;

    expect(component['searchForm'].queries[0]!().disabled()).toBe(false);
    expect(component['searchForm'].queries[1]!().disabled()).toBe(false);
    expect(component['searchModel']().queries).toEqual(['  Corrected title  ', 'New title']);
    await component['onSearchRow'](0);
    expect(api.searchExternalMetadata).toHaveBeenLastCalledWith(
      { s: 'Corrected title', provider: 'omdb' },
      { suppressErrorAlert: true }
    );
  });

  it('prevents selecting the same provider identity in multiple rows and releases skipped selections', () => {
    const metadata = buildMetadata();
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [buildRow('first'), buildRow('second')]);
    component['onSelect'](0, metadata);
    expect(component['isDuplicate'](metadata, 'second')).toBe(true);
    expect(component['isDuplicate'](metadata, 'first')).toBe(false);
    component['onSelect'](1, metadata);
    expect(component['state'].rows()[1]!.selected).toBeNull();
    component['onSkip'](0);
    component['onSelect'](1, metadata);
    expect(component['state'].rows()[1]!.selected).toEqual(metadata);
    expect(component['selectedCount']()).toBe(1);
  });

  it.each([
    ['movie', 'omdb', 'tt123'],
    ['book', 'openlibrary', '9780140328721'],
    ['album', 'musicbrainz', 'release-mbid'],
  ] as const)(
    'maps %s matches into shared cards without losing provider identities',
    (contentType, provider, providerItemId) => {
      const match = buildMetadata({ contentType, provider, providerItemId });
      const first = buildRow('first', match);
      const second = { ...buildRow('second'), matches: [match] };
      const store = fixture.debugElement.injector.get(photoImportStateToken);
      store.setState('rows', [first, second]);
      const option = component['matchOptions'](second)[0]!;
      expect(option).toEqual(
        expect.objectContaining({
          value: `${provider}/${providerItemId}`,
          text: match.title,
          poster: match.poster,
          disabled: true,
          hint: 'PhotoImport.Duplicate',
        })
      );
      component['onMatchSelected'](1, option);
      expect(component['state'].rows()[1]!.selected).toBeNull();
      component['onSkip'](0);
      expect(component['matchOptions'](second)[0]!.disabled).toBe(false);
      component['onMatchSelected'](1, option);
      expect(component['state'].rows()[1]!.selected).toEqual(match);
      component['onMatchSelected'](1, { text: 'Unknown', value: 'unknown' });
      expect(component['state'].rows()[1]!.selected).toEqual(match);
    }
  );

  it('does not change selections, start searches, or replace photos while busy', async () => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [buildRow('row')]);
    store.setState('busy', true);
    await selectFiles([new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })]);
    component['onSelect'](0, buildMetadata());
    component['onSkip'](0);
    await component['onSearchRow'](0);
    await component['readPhotos']();
    await component['addSelected']();
    expect(component['state'].rows()[0]).toEqual(buildRow('row'));
    expect(component['state'].photos()).toEqual([]);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
    expect(api.recognizePhoto).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps added and existing rows terminal when search, select, or skip is requested', async () => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    const rows = (['added', 'exists'] as const).map((status) => ({ ...buildRow(status), status }));
    store.setState('rows', rows);
    component['searchModel'].set({ queries: ['First', 'Second'] });
    for (const index of [0, 1]) {
      component['onSelect'](index, buildMetadata());
      component['onSkip'](index);
      await component['onSearchRow'](index);
    }
    expect(component['state'].rows()).toEqual(rows);
    expect(api.searchExternalMetadata).not.toHaveBeenCalled();
  });

  it('guards unfinished drafts but closes clean or terminal drafts without confirmation', async () => {
    expect(await component['canClose']()).toBe(true);
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [buildRow('row')]);
    expect(await component['canClose']()).toBe(false);
    expect(confirm.open).toHaveBeenCalledWith('Confirm.DiscardChanges');
    confirm.open.mockReturnValue(of(true));
    expect(await component['canClose']()).toBe(true);
    confirm.open.mockClear();
    store.setState(
      'rows',
      (['added', 'exists', 'skipped'] as const).map((status, index) => ({
        ...buildRow(`row-${index}`),
        status,
      }))
    );
    expect(await component['canClose']()).toBe(true);
    expect(confirm.open).not.toHaveBeenCalled();
  });

  it('fetches full metadata before checking identities and creating in the fixed destination', async () => {
    const selected = buildMetadata({ title: 'Search result' });
    const metadata = buildMetadata({
      title: 'Detailed title',
      providerItemId: 'tt456',
      externalIds: [{ source: 'imdb', id: 'tt456' }],
    });
    api.getExternalMetadataItem.mockReturnValue(of(metadata));
    fixture.componentRef.setInput('targetOwnerShareCode', 'owner');
    fixture.componentRef.setInput('listType', 'wishlist');
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', selected)]);
    await component['addSelected']();
    expect(api.getExternalMetadataItem).toHaveBeenCalledWith(
      { externalIdentitySource: 'omdb', externalIdentityId: 'tt123' },
      { suppressErrorAlert: true }
    );
    expect(api.collectionItemExists).toHaveBeenCalledWith('omdb', 'tt456', 'owner', 'wishlist', metadata.externalIds, {
      suppressErrorAlert: true,
    });
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Detailed title',
        externalProvider: 'omdb',
        externalItemId: 'tt456',
        externalIds: metadata.externalIds,
        IMDbId: 'tt456',
        tags: [],
        userRate: null,
        favorite: false,
      }),
      'owner',
      'wishlist',
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0]!.status).toBe('added');
    expect(collection.addCollectionItem).toHaveBeenCalledWith({ title: 'The Matrix', id: 1 }, true);
    expect(collection.triggerReload).toHaveBeenCalledOnce();
  });

  it.each([
    ['movie', 'finished'],
    ['series', 'copyToTrackingAsCompleted'],
  ] as const)(
    'applies each %s row choice in the shared destination and inserts returned items',
    async (contentType, option) => {
      fixture.componentRef.setInput('trackingEnabled', true);
      fixture.componentRef.setInput('contentType', contentType);
      fixture.componentRef.setInput('targetOwnerShareCode', 'owner');
      const metadata = buildMetadata({ contentType });
      api.getExternalMetadataItem.mockReturnValue(of(metadata));
      const collectionItem = { id: 10, title: 'Updated library item', watched: true };
      const finishedItem = contentType === 'movie' ? { id: 11, title: 'Completed movie' } : null;
      const trackingItem = contentType === 'series' ? { id: 12, title: 'Completed series' } : null;
      newItem.applySideEffects
        .mockReturnValueOnce(of({ collectionItem, finishedItem, trackingItem, trackerUpdateFailed: false }))
        .mockReturnValueOnce(
          of({ collectionItem, finishedItem: null, trackingItem: null, trackerUpdateFailed: false })
        );
      fixture.debugElement.injector
        .get(photoImportStateToken)
        .setState('rows', [
          { ...buildRow('selected', metadata), [option]: true },
          buildRow('unchecked', buildMetadata({ contentType, providerItemId: 'tt456' })),
        ]);

      await component['addSelected']();

      const expectedOptions = {
        collectionItem: { title: 'The Matrix', id: 1 },
        listType: 'library',
        targetOwnerShareCode: 'owner',
        selectedContentIsMovie: contentType === 'movie',
        selectedContentIsSeries: contentType === 'series',
        finished: false,
        copyToTrackingAsCompleted: false,
      };
      expect(newItem.applySideEffects).toHaveBeenNthCalledWith(1, { ...expectedOptions, [option]: true });
      expect(newItem.applySideEffects).toHaveBeenNthCalledWith(2, expectedOptions);
      expect(collection.addCollectionItem.mock.calls).toEqual([
        [collectionItem, true],
        [finishedItem ?? trackingItem, true],
        [collectionItem, true],
      ]);
      expect(component['state'].rows().map((row) => row.status)).toEqual(['added', 'added']);
    }
  );

  it('does not apply stored tracking choices when the preference is disabled', async () => {
    fixture.debugElement.injector
      .get(photoImportStateToken)
      .setState('rows', [{ ...buildRow('row', buildMetadata()), finished: true, copyToTrackingAsCompleted: true }]);
    await component['addSelected']();
    expect(newItem.applySideEffects).toHaveBeenCalledWith(
      expect.objectContaining({ finished: false, copyToTrackingAsCompleted: false })
    );
  });

  it('warns about partial tracking failure, continues the batch, and never recreates successful library items', async () => {
    await renderTemplate();
    fixture.componentRef.setInput('trackingEnabled', true);
    const collectionItem = { id: 1, title: 'The Matrix' };
    newItem.applySideEffects
      .mockReturnValueOnce(of({ collectionItem, finishedItem: null, trackingItem: null, trackerUpdateFailed: true }))
      .mockReturnValueOnce(of({ collectionItem, finishedItem: null, trackingItem: null, trackerUpdateFailed: false }));
    fixture.debugElement.injector
      .get(photoImportStateToken)
      .setState('rows', [
        { ...buildRow('first', buildMetadata()), finished: true },
        buildRow('second', buildMetadata({ providerItemId: 'tt456' })),
      ]);
    component['searchModel'].set({ queries: ['First', 'Second'] });

    await component['addSelected']();
    await fixture.whenStable();

    expect(component['state'].rows()).toEqual([
      expect.objectContaining({ status: 'added', trackerUpdateFailed: true }),
      expect.objectContaining({ status: 'added', trackerUpdateFailed: false }),
    ]);
    const element: HTMLElement = fixture.nativeElement;
    const warnings = element.querySelectorAll('[data-test-id="photo-import-tracking-error"]');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.getAttribute('role')).toBe('alert');
    expect(warnings[0]!.textContent).toBe('Toast.NewItemTrackerUpdateError');
    expect(component['selectedCount']()).toBe(0);
    expect(await component.canClose()).toBe(true);
    expect(component.busy()).toBe(false);
    expect(collection.addCollectionItem).toHaveBeenCalledTimes(2);
    expect(collection.triggerReload).toHaveBeenCalledOnce();
    await component['addSelected']();
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(newItem.applySideEffects).toHaveBeenCalledTimes(2);
  });

  it('keeps failed rows selected for retry without resubmitting added, existing, or skipped rows', async () => {
    const store = fixture.debugElement.injector.get(photoImportStateToken);
    store.setState('rows', [
      buildRow('added', buildMetadata()),
      buildRow('existing', buildMetadata()),
      buildRow('retry', buildMetadata()),
      { ...buildRow('skipped', buildMetadata()), status: 'skipped' },
    ]);
    api.collectionItemExists
      .mockReturnValueOnce(of({ exists: false }))
      .mockReturnValueOnce(of({ exists: true }))
      .mockReturnValue(of({ exists: false }));
    api.create
      .mockReturnValueOnce(of({ item: { title: 'Added' } }))
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of({ item: { title: 'Retried' } }));
    await component['addSelected']();
    expect(component['state'].rows().map((row) => row.status)).toEqual(['added', 'exists', 'error', 'skipped']);
    expect(component['state'].rows()[2]!.selected).not.toBeNull();
    await component['addSelected']();
    expect(api.getExternalMetadataItem).toHaveBeenCalledTimes(4);
    expect(api.create).toHaveBeenCalledTimes(3);
    expect(component['state'].rows().map((row) => row.status)).toEqual(['added', 'exists', 'added', 'skipped']);
    expect(component['state'].busy()).toBe(false);
  });

  it('treats a create conflict as existing and does not retry it', async () => {
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', buildMetadata())]);
    api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await component['addSelected']();
    await component['addSelected']();
    expect(component['state'].rows()[0]!.status).toBe('exists');
    expect(api.create).toHaveBeenCalledOnce();
    expect(collection.addCollectionItem).not.toHaveBeenCalled();
  });

  it('creates in the selected shared destination when duplicate preflight is forbidden', async () => {
    fixture.componentRef.setInput('targetOwnerShareCode', 'selected-item-owner');
    fixture.componentRef.setInput('listType', 'wishlist');
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', buildMetadata())]);
    api.collectionItemExists.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    await component['addSelected']();

    expect(api.collectionItemExists).toHaveBeenCalledWith(
      'omdb',
      'tt123',
      'selected-item-owner',
      'wishlist',
      [{ source: 'imdb', id: 'tt123' }],
      { suppressErrorAlert: true }
    );
    expect(api.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ externalProvider: 'omdb', externalItemId: 'tt123' }),
      'selected-item-owner',
      'wishlist',
      { suppressErrorAlert: true }
    );
    expect(component['state'].rows()[0]!.status).toBe('added');
    expect(collection.addCollectionItem).toHaveBeenCalledOnce();
  });

  it('keeps a forbidden create retryable rather than marking the shared item as existing', async () => {
    const selected = buildMetadata();
    fixture.componentRef.setInput('targetOwnerShareCode', 'selected-item-owner');
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', selected)]);
    api.collectionItemExists.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    api.create.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));

    await component['addSelected']();

    expect(component['state'].rows()[0]).toEqual(expect.objectContaining({ status: 'error', selected }));
    expect(component['selectedCount']()).toBe(1);
    expect(component['state'].busy()).toBe(false);
    expect(collection.addCollectionItem).not.toHaveBeenCalled();

    await component['addSelected']();

    expect(api.create).toHaveBeenCalledTimes(2);
    expect(component['state'].rows()[0]!.status).toBe('added');
  });

  it('does not create after a network preflight failure and retains the selection for retry', async () => {
    const selected = buildMetadata();
    fixture.componentRef.setInput('targetOwnerShareCode', 'shared-owner');
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', selected)]);
    api.collectionItemExists.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));

    await component['addSelected']();

    expect(api.create).not.toHaveBeenCalled();
    expect(component['state'].rows()[0]).toEqual(expect.objectContaining({ status: 'error', selected }));
    expect(component['selectedCount']()).toBe(1);
    expect(component['state'].busy()).toBe(false);

    await component['addSelected']();

    expect(api.create).toHaveBeenCalledOnce();
    expect(component['state'].rows()[0]!.status).toBe('added');
  });

  it('does not create items when metadata details have the wrong type or no identity', async () => {
    fixture.debugElement.injector.get(photoImportStateToken).setState('rows', [buildRow('row', buildMetadata())]);
    api.getExternalMetadataItem
      .mockReturnValueOnce(of(buildMetadata({ contentType: 'series' })))
      .mockReturnValueOnce(of(buildMetadata({ providerItemId: '' })));
    await component['addSelected']();
    await component['addSelected']();
    expect(api.collectionItemExists).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    expect(component['state'].rows()[0]!.status).toBe('error');
  });

  it('adds sequentially and stops after the current create finishes', async () => {
    const pending = new Subject<{ item: { title: string } }>();
    api.create.mockReturnValue(pending);
    fixture.debugElement.injector
      .get(photoImportStateToken)
      .setState('rows', [buildRow('first', buildMetadata()), buildRow('second', buildMetadata())]);
    const adding = component['addSelected']();
    await vi.waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect(api.getExternalMetadataItem).toHaveBeenCalledOnce();
    component['requestStop']();
    pending.next({ item: { title: 'First' } });
    await adding;
    expect(api.create).toHaveBeenCalledOnce();
    expect(component['state'].rows().map((row) => row.status)).toEqual(['added', 'ready']);
    expect(component['selectedCount']()).toBe(1);
    expect(component['state'].busy()).toBe(false);
  });
});
