import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSharesState, SharesState, sharesStateToken } from '../../shares/shares-store';
import { NewItemDialog } from './new-item-dialog';
import { NewItemDialogService } from './new-item-dialog-service';

describe('NewItemDialog component', () => {
  let fixture: ComponentFixture<NewItemDialog>;
  let component: NewItemDialog;
  let service: {
    matchedContent: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let api: { collectionItemExists: ReturnType<typeof vi.fn>; getShares: ReturnType<typeof vi.fn> };
  let sharesState: NgxSimpleSignalStoreService<SharesState>;

  beforeEach(() => {
    vi.useFakeTimers();
    service = {
      matchedContent: vi.fn(() => [{ text: 'First', value: 'tt123' }]),
      search: vi.fn(),
      save: vi.fn(() => of(undefined)),
    };
    api = {
      collectionItemExists: vi.fn(() => of({ exists: false })),
      getShares: vi.fn(() => of({ userShareCode: '', outgoing: [], incoming: [] })),
    };

    TestBed.configureTestingModule({
      imports: [NewItemDialog],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
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
          {
            provide: AutocompleteService,
            useValue: { getSuggestion: vi.fn(), formatSuggestionText: vi.fn() },
          },
        ],
      },
    });

    fixture = TestBed.createComponent(NewItemDialog);
    component = fixture.componentInstance;
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

  it('invokes save and resets when mode is new', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', '#tag', 'new', undefined, undefined);
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('appends watched tag before saving in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', `#tag ${WATCHED_TAG}`, 'new', undefined, undefined);
    expect(formRoot.reset).toHaveBeenCalled();
    expect(component['form'].watched().value()).toBe(false);
  });

  it('saves only watched tag when no tags are provided in new mode', async () => {
    const formRoot = component['form']();
    vi.spyOn(formRoot, 'reset');

    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].watched().value.set(true);

    await component['onSave']('new');

    expect(service.save).toHaveBeenCalledWith('tt123', WATCHED_TAG, 'new', undefined, undefined);
    expect(formRoot.reset).toHaveBeenCalled();
  });

  it('resets only the IMDb ID field when mode is not new', async () => {
    const selectedIMDbId = component['form'].selectedIMDbId();
    vi.spyOn(selectedIMDbId, 'reset');
    selectedIMDbId.value.set('tt456');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt456', '', 'close', undefined, undefined);
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

    expect(service.save).toHaveBeenCalledWith('tt123', '', 'close', 'owner-code', undefined);
  });

  it('saves wishlist items without watched or shared library values', async () => {
    fixture.componentRef.setInput('wishlist', true);
    component['form'].selectedIMDbId().value.set('tt123');
    component['form'].tags().value.set('#tag');
    component['form'].watched().value.set(true);
    component['form'].targetOwnerShareCode().value.set('owner-code');

    await component['onSave']('close');

    expect(service.save).toHaveBeenCalledWith('tt123', '#tag', 'close', undefined, 'wishlist');
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
    component['form'].selectedIMDbId().value.set('tt123');
    await vi.advanceTimersByTimeAsync(150);
    api.collectionItemExists.mockClear();

    component['form'].targetOwnerShareCode().value.set('owner-code');
    await vi.advanceTimersByTimeAsync(150);

    expect(api.collectionItemExists).toHaveBeenCalledWith('tt123', 'owner-code');
  });

  it('exits when there is no selected IMDb id', () => {
    component['form'].selectedIMDbId().value.set(null);

    component['onSave']();

    expect(service.save).not.toHaveBeenCalled();
  });
});
