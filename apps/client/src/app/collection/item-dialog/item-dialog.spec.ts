import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { initialSharesState, SharesState, sharesStateToken } from '../../shares/shares-store';
import { CollectionItemModel } from '../collection-model';
import { CollectionService } from '../collection-service';
import { ItemDialog } from './item-dialog';

const buildItem = (overrides: Partial<CollectionItemModel> = {}): CollectionItemModel => ({
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama', 'Thriller'],
  IMDbId: 'tt1234567',
  tags: [MOVIE_TAG, '#action'],
  year: 2020,
  rate: '8.5',
  hash: 'testhash',
  actors: 'Actor One, Actor Two',
  plot: 'A test plot.',
  ...overrides,
});

const buildApiItem = (overrides: Partial<CollectionItemApiModel> = {}): CollectionItemApiModel => ({
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama', 'Thriller'],
  IMDbId: 'tt1234567',
  tags: [MOVIE_TAG, '#action'],
  year: 2020,
  rate: '8.5',
  hash: 'newhash',
  actors: 'Actor One, Actor Two',
  plot: 'A test plot.',
  ...overrides,
});

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let component: ItemDialog;
  let collectionService: {
    deleteCollectionItem: ReturnType<typeof vi.fn>;
    updateCollectionItem: ReturnType<typeof vi.fn>;
    triggerReload: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let api: {
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;
  let translate: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = {
      deleteCollectionItem: vi.fn(),
      updateCollectionItem: vi.fn(),
      triggerReload: vi.fn(),
    };
    portal = { close: vi.fn() };
    confirm = { open: vi.fn() };
    api = {
      delete: vi.fn(() => of(undefined)),
      update: vi.fn(() => of({ item: buildApiItem() })),
    };
    translate = { translate: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialMainState, mainStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });
    TestBed.overrideComponent(ItemDialog, {
      set: {
        template: '',
      },
    });

    fixture = TestBed.createComponent(ItemDialog);
    component = fixture.componentInstance;
    toastState = TestBed.inject(toastStateToken);
    sharesState = TestBed.inject(sharesStateToken);

    fixture.componentRef.setInput('collectionItem', buildItem());
    fixture.detectChanges();
  });

  it('initializes draft item from the input model', () => {
    expect(component['draftItem']().title).toBe('Test Movie');
    expect(component['draftItem']().IMDbId).toBe('tt1234567');
    expect(component['draftItem']().tags).toEqual([MOVIE_TAG, '#action']);
  });

  it('toggles edit mode', () => {
    expect(component['editMode']()).toBe(false);

    component['onEdit']();
    expect(component['editMode']()).toBe(true);

    component['onReadOnly']();
    expect(component['editMode']()).toBe(false);
  });

  it('restores last saved item when switching back to read-only', () => {
    component['onEdit']();
    component['updateDraft']('title', 'Modified Title');
    expect(component['draftItem']().title).toBe('Modified Title');

    component['onReadOnly']();
    expect(component['draftItem']().title).toBe('Test Movie');
    expect(component['editMode']()).toBe(false);
  });

  it('computes watched status from tags', () => {
    expect(component['watched']()).toBe(false);

    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, WATCHED_TAG] }));
    fixture.detectChanges();

    expect(component['watched']()).toBe(true);
  });

  it('uses incoming share permissions for shared collection items', () => {
    sharesState.setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerUsername: 'Owner',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: true,
      },
    ]);
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    expect(component['isShared']()).toBe(true);
    expect(component['library']()).toBe('Owner');
    expect(component['permissionUpdate']()).toBe(false);
    expect(component['permissionDelete']()).toBe(true);
  });

  it('does not allow shared item changes when share permissions are not loaded', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    expect(component['isShared']()).toBe(false);
    expect(component['permissionUpdate']()).toBe(false);
    expect(component['permissionDelete']()).toBe(false);
  });

  it('allows changes for the current user library by share code', () => {
    sharesState.setState('userShareCode', 'own-code');
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'own-code' }));
    fixture.detectChanges();

    expect(component['permissionUpdate']()).toBe(true);
    expect(component['permissionDelete']()).toBe(true);
  });

  it('passes the owner share code when changing a shared item', () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();
    component['updateDraft']('title', 'Updated Shared Title');

    component['onSaveChanges']();

    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ title: 'Updated Shared Title' }),
      'testhash',
      'owner-code'
    );
  });

  it('passes the owner share code when deleting a shared item', () => {
    confirm.open.mockReturnValue(of(true));
    fixture.componentRef.setInput('collectionItem', buildItem({ ownerShareCode: 'owner-code' }));
    fixture.detectChanges();

    component['onDelete']();

    expect(api.delete).toHaveBeenCalledWith('tt1234567', 'testhash', 'owner-code');
  });

  it('computes genre and tags text from draft item', () => {
    expect(component['genreText']()).toBe('Drama, Thriller');
    expect(component['tagsText']()).toBe(`${MOVIE_TAG} #action`);
  });

  it('deletes an item after confirmation', () => {
    confirm.open.mockReturnValue(of(true));

    component['onDelete']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('tt1234567', 'testhash', undefined);
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('tt1234567', undefined);
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(portal.close).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.DeleteItem');
  });

  it('does not delete when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));

    component['onDelete']();

    expect(api.delete).not.toHaveBeenCalled();
    expect(collectionService.deleteCollectionItem).not.toHaveBeenCalled();
    expect(portal.close).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('saves changes after confirmation and updates state', () => {
    confirm.open.mockReturnValue(of(true));
    component['updateDraft']('title', 'Updated Title');

    component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ title: 'Updated Title' }),
      'testhash',
      undefined
    );
    expect(collectionService.updateCollectionItem).toHaveBeenCalledWith('tt1234567', expect.any(Object), undefined);
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.EditItem');
    expect(component['editMode']()).toBe(false);
  });

  it('does not save when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));
    component['updateDraft']('title', 'Updated Title');

    component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when title is empty', () => {
    component['updateDraft']('title', '  ');

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.MissingRequiredField');
  });

  it('does not save when IMDbId is empty', () => {
    component['updateDraft']('IMDbId', '  ');

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.MissingRequiredField');
  });

  it('does not save when tags contain virtual tags', () => {
    component['updateDraft']('tags', [MOVIE_TAG, VIRTUAL_UNWATCHED_TAG]);

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.VirtualTagNotAllowed');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save when tags lack a type tag', () => {
    component['updateDraft']('tags', ['#action']);

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.MissingTypeTag');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('allows series tag as valid type tag', () => {
    confirm.open.mockReturnValue(of(true));
    component['updateDraft']('tags', [SERIES_TAG, '#drama']);

    component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalled();
  });

  it('marks item as watched by appending watched tag and saving', () => {
    confirm.open.mockReturnValue(of(true));

    component['onMarkAsWatched']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: expect.arrayContaining([WATCHED_TAG]) }),
      'testhash',
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('does not re-save when already watched', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, WATCHED_TAG] }));
    fixture.detectChanges();
    component.ngOnInit();
    confirm.open.mockReturnValue(of(true));

    component['onMarkAsWatched']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('marks item as unwatched by removing watched tag and saving', () => {
    fixture.componentRef.setInput('collectionItem', buildItem({ tags: [MOVIE_TAG, WATCHED_TAG, '#action'] }));
    fixture.detectChanges();
    confirm.open.mockReturnValue(of(true));

    component['onMarkAsUnwatched']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith(
      'tt1234567',
      expect.objectContaining({ tags: expect.not.arrayContaining([WATCHED_TAG]) }),
      'testhash',
      undefined
    );
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('updates year to number when valid', () => {
    component['updateYear']('2021');
    expect(component['draftItem']().year).toBe(2021);
  });

  it('updates year to null when empty', () => {
    component['updateYear']('');
    expect(component['draftItem']().year).toBeNull();
  });

  it('updates year to null when invalid', () => {
    component['updateYear']('abc');
    expect(component['draftItem']().year).toBeNull();
  });

  it('updates genre from comma-separated text', () => {
    component['updateGenre']('Action, Comedy');
    expect(component['draftItem']().genre).toEqual(['Action', 'Comedy']);
  });

  it('updates tags from space-separated text', () => {
    component['updateTags']('#tag1 #tag2');
    expect(component['draftItem']().tags).toEqual(['#tag1', '#tag2']);
  });

  it('sets posterImageFailed on image error', () => {
    expect(component['posterImageFailed']()).toBe(false);
    component['onPosterImageError']();
    expect(component['posterImageFailed']()).toBe(true);
  });

  it('computes proxy image urls', () => {
    const apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', 'http://localhost:3000');
    fixture.detectChanges();

    expect(component['imageUrl']()).toContain('/proxy/image?url=');
    expect(component['draftImageUrl']()).toContain('/proxy/image?url=');
  });

  it('computes trailer, imdb, and web search urls', () => {
    expect(component['trailerUrl']()).toContain('youtube.com');
    expect(component['imdbUrl']()).toBe('https://www.imdb.com/title/tt1234567/');
    expect(component['webSearchUrl']()).toContain('duckduckgo.com');
  });
});
