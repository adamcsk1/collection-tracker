import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import * as collectionUtils from '@client/collection/utils/get-collection-item-util';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { ItemDialog } from './item-dialog';

jest.mock('marked', () => ({ marked: { parse: jest.fn(() => '<p>parsed</p>') } }));

const buildItem = (name: string, rawContent = 'raw content'): CollectionItemModel => ({
  rawContent,
  image: 'image',
  title: name,
  genre: [],
  IMDbId: 'tt123',
  tags: [],
  name,
  year: 2020,
  rate: '9.0',
});

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let component: ItemDialog;
  let collectionService: { deleteCollectionItem: jest.Mock; updateCollectionItem: jest.Mock };
  let portal: { close: jest.Mock };
  let confirm: { open: jest.Mock };
  let api: { delete: jest.Mock; update: jest.Mock };
  let toastState: NgxSimpleSignalStoreService<typeof initialToastState>;
  let translate: { translate: jest.Mock };
  let getCollectionItemSpy: jest.SpyInstance;

  beforeEach(() => {
    collectionService = {
      deleteCollectionItem: jest.fn(),
      updateCollectionItem: jest.fn(),
    };
    portal = { close: jest.fn() };
    confirm = { open: jest.fn() };
    api = {
      delete: jest.fn(() => of(undefined)),
      update: jest.fn(() => of(undefined)),
    };
    translate = { translate: jest.fn((key: string) => key) };
    getCollectionItemSpy = jest
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
    expect(component['rawContentControl'].value).toBe('raw content');
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
    component['rawContentControl'].setValue('updated content');
    const updateSpy = jest.spyOn(component.collectionItem as any, 'update');

    component['onSaveChanges']();

    expect(confirm.open).toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('Item One', 'updated content');
    expect(collectionService.updateCollectionItem).toHaveBeenCalledWith('Item One', 'updated content');
    expect(updateSpy).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.EditItem');
    expect(component['editMode']()).toBe(false);
  });

  it('does not save when confirmation is declined', () => {
    confirm.open.mockReturnValue(of(false));
    component['rawContentControl'].setValue('no change');

    component['onSaveChanges']();

    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.updateCollectionItem).not.toHaveBeenCalled();
    expect(toastState.state.message()).toBe('');
  });
});
