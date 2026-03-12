import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import * as collectionUtils from '@client/collection/utils/get-collection-item-util';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemDialog } from './item-dialog';

vi.mock('marked', () => ({ marked: { parse: vi.fn(() => '<p>parsed</p>') } }));

const buildItem = (name: string, rawContent = 'raw content'): CollectionItemModel => ({
  rawContent,
  rawContentLower: rawContent.toLowerCase(),
  image: 'image',
  title: name,
  titleLower: name.toLowerCase(),
  genre: ['Drama'],
  IMDbId: 'tt123',
  tags: ['#movie'],
  name,
  year: 2020,
  rate: '9.0',
});

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let component: ItemDialog;
  let collectionService: {
    deleteCollectionItem: ReturnType<typeof vi.fn>;
    updateCollectionItem: ReturnType<typeof vi.fn>;
  };
  let portal: { close: ReturnType<typeof vi.fn> };
  let confirm: { open: ReturnType<typeof vi.fn> };
  let api: { delete: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<typeof initialToastState>;
  let translate: { translate: ReturnType<typeof vi.fn> };
  let getCollectionItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    collectionService = {
      deleteCollectionItem: vi.fn(),
      updateCollectionItem: vi.fn(),
    };
    portal = { close: vi.fn() };
    confirm = { open: vi.fn() };
    api = {
      delete: vi.fn(() => of(undefined)),
      update: vi.fn(() => of(undefined)),
    };
    translate = { translate: vi.fn((key: string) => key) };
    getCollectionItemSpy = vi
      .spyOn(collectionUtils, 'getCollectionItem')
      .mockImplementation((input) => buildItem(input.name as string, input.content as string));

    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: translate },
        provideStore(initialMainState, mainStateToken),
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
    toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<typeof initialToastState>;

    (component.collectionItem as any).set(buildItem('Item One'));
    fixture.detectChanges();
  });

  afterEach(() => {
    getCollectionItemSpy.mockRestore();
  });

  it('initializes raw content control from the input model', () => {
    expect(component['rawContentModel']()).toBe('raw content');
  });

  it('deletes an item after confirmation', () => {
    confirm.open.mockReturnValue(of(true));

    component['onDelete']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('Item One');
    expect(collectionService.deleteCollectionItem).toHaveBeenCalledWith('Item One');
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

  it('toggles edit mode', () => {
    component['onEdit']();
    expect(component['editMode']()).toBe(true);

    component['onReadOnly']();
    expect(component['editMode']()).toBe(false);
  });

  it('saves changes after confirmation and updates state', () => {
    confirm.open.mockReturnValue(of(true));
    component['rawContentModel'].set('updated content #movie');
    const updateSpy = vi.spyOn(component.collectionItem as any, 'update');

    component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('Item One', 'updated content #movie');
    expect(collectionService.updateCollectionItem).toHaveBeenCalledWith('Item One', 'updated content #movie');
    expect(updateSpy).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.EditItem');
    expect(component['editMode']()).toBe(false);
  });

  it('does not save when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));
    component['rawContentModel'].set('#movie no change');

    component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });

  it('does not save when parsed raw content is invalid', () => {
    getCollectionItemSpy.mockImplementationOnce(() => ({
      rawContent: '',
      rawContentLower: '',
      image: '',
      title: '',
      titleLower: '',
      genre: [],
      IMDbId: '',
      tags: [],
      name: 'Item One',
      year: null,
      rate: '',
    }));

    component['rawContentModel'].set('#movie bad content');

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.BadRawContent');
  });

  it('does not save when raw content is missing required parsed fields', () => {
    getCollectionItemSpy.mockImplementationOnce(() => ({
      rawContent: '',
      rawContentLower: '',
      image: '',
      title: '',
      titleLower: '',
      genre: [],
      tags: ['#movie'],
      IMDbId: '',
      year: null,
      rate: '',
      name: 'Item One',
    }));

    component['rawContentModel'].set('#movie another bad content');

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.BadRawContent');
  });

  it('does not save when raw content contains virtual tags', () => {
    component['rawContentModel'].set(`#movie #unwatched`);

    component['onSaveChanges']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.UsedVirtualTagInContent');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('restores unsaved content when switching back to read-only mode', () => {
    component['rawContentModel'].set('modified content');
    component['onReadOnly']();

    expect(component['rawContentModel']()).toBe('raw content');
    expect(component['editMode']()).toBe(false);
  });

  it('appends watched tag and saves when marking as watched', () => {
    component['rawContentModel'].set('**Tags** #movie #action');
    confirm.open.mockReturnValue(of(true));

    component['onMarkAsWatched']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('Item One', expect.stringContaining(WATCHED_TAG));
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });

  it('prevents marking as watched when content has no editable tag section', () => {
    component['rawContentModel'].set('No tags present');

    component['onMarkAsWatched']();

    expect(confirm.open).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.SetWatchedError');
  });

  it('removes watched tag and saves when marking as unwatched', () => {
    component['rawContentModel'].set('**Tags** #movie #watched');
    confirm.open.mockReturnValue(of(true));

    component['onMarkAsUnwatched']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('Item One', expect.anything());
    expect(api.update.mock.calls[0][1].includes(WATCHED_TAG)).toBe(false);
    expect(toastState.state.message()).toBe('Toast.EditItem');
  });
});
