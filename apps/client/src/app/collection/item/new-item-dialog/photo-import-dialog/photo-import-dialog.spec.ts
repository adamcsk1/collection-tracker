import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PHOTO_IMPORT_MAX_BYTES, PHOTO_IMPORT_MAX_PHOTOS } from '@shared/constants/photo-import-const';
import { ExternalMetadataItemModel } from '@shared/models/external-metadata-model';
import { PhotoImportRecognizeResponseModel } from '@shared/models/photo-import-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../../collection-service';
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
    collectionItemExists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let collection: { addCollectionItem: ReturnType<typeof vi.fn>; triggerReload: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };

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
      collectionItemExists: vi.fn(() => of({ exists: false })),
      create: vi.fn(() => of({ item: { title: 'The Matrix', id: 1 } })),
    };
    collection = { addCollectionItem: vi.fn(), triggerReload: vi.fn() };
    confirm = { open: vi.fn(() => of(false)) };
    TestBed.configureTestingModule({
      imports: [PhotoImportDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CollectionService, useValue: collection },
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
    vi.restoreAllMocks();
  });

  it('provides isolated dialog state and checks vision availability on initialization', () => {
    expect(fixture.nativeElement.classList.contains('dialog')).toBe(false);
    expect(fixture.debugElement.injector.get(photoImportStateToken).state.photos()).toEqual([]);
    expect(api.getPhotoImportAvailability).toHaveBeenCalledOnce();
    expect(component['state'].availability()).toEqual({ available: true, reason: 'available' });
  });

  it('renders an embedded workflow and shared review cards, exposing actions for the parent footer', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PhotoImportDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CollectionService, useValue: collection },
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
