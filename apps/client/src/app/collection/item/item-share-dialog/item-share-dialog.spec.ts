import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { CollectionItemShareApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionService } from '../../collection-service';
import { initialSharesState, sharesStateToken } from '../../../shares/shares-store';
import { ItemShareDialog } from './item-share-dialog';

const shares: CollectionItemShareApiModel[] = [
  {
    sharedWithUserShareCode: 'broad-code',
    sharedWithUsername: 'Broad',
    readMode: 'all',
    permissions: { canRead: true, canCreate: true, canUpdate: false, canDelete: false },
  },
  {
    sharedWithUserShareCode: 'selected-code',
    sharedWithUsername: 'Selected',
    readMode: 'selected',
    permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
  },
  {
    sharedWithUserShareCode: 'none-code',
    sharedWithUsername: 'None',
    readMode: 'none',
    permissions: null,
  },
  {
    sharedWithUserShareCode: 'later-code',
    sharedWithUsername: 'Later item',
    readMode: 'none',
    permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: true },
  },
];

describe('ItemShareDialog', () => {
  let fixture: ComponentFixture<ItemShareDialog>;
  let component: ItemShareDialog;
  let api: {
    getCollectionItemShares: ReturnType<typeof vi.fn>;
    saveCollectionItemShares: ReturnType<typeof vi.fn>;
    getShares: ReturnType<typeof vi.fn>;
  };
  let portal: { closeTop: ReturnType<typeof vi.fn>; closeAll: ReturnType<typeof vi.fn> };
  let collectionService: { triggerReload: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toastState: NgxSimpleSignalStoreService<ToastState>;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    api = {
      getCollectionItemShares: vi.fn(() => of(shares)),
      saveCollectionItemShares: vi.fn(() => of(undefined)),
      getShares: vi.fn(() => of({ userShareCode: 'own-code', outgoing: [], incoming: [] })),
    };
    portal = { closeTop: vi.fn(), closeAll: vi.fn() };
    collectionService = { triggerReload: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [ItemShareDialog],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: CollectionService, useValue: collectionService },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: router },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialToastState, toastStateToken),
        provideStore(initialSharesState, sharesStateToken),
      ],
    });
    trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    fixture = TestBed.createComponent(ItemShareDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('externalProvider', 'omdb');
    fixture.componentRef.setInput('externalItemId', 'tt1234567');
    fixture.componentRef.setInput('listType', 'library');
    fixture.componentRef.setInput('itemTitle', 'Movie');
    toastState = TestBed.inject(toastStateToken);
    fixture.detectChanges();
  });

  afterEach(() => trigger.remove());

  it('loads and renders broad, selected, and unselected recipient states', async () => {
    await fixture.whenStable();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('item-share-dialog-title');
    expect((fixture.nativeElement as HTMLElement).querySelector('.recipient-list')?.tagName).toBe('UL');
    expect(api.getCollectionItemShares).toHaveBeenCalledWith('omdb', 'tt1234567', 'library');
    expect(getCheckbox('item-share-recipient-broad-code').checked).toBe(true);
    expect(getCheckbox('item-share-recipient-broad-code').disabled).toBe(true);
    expect(query('item-share-broad-broad-code')).toBeTruthy();
    expect(getCheckbox('item-share-recipient-broad-code').getAttribute('aria-describedby')).toBe(
      'item-share-broad-broad-code'
    );
    expect(getCheckbox('item-share-recipient-selected-code').checked).toBe(true);
    expect(query('item-share-permissions-selected-code')).toBeNull();
    expect(getCheckbox('item-share-recipient-none-code').checked).toBe(false);
    expect(query('item-share-permissions-later-code')).toBeNull();
  });

  it('shows required permissions immediately when selecting a recipient without access', async () => {
    component['onRecipientToggle']('none-code', true);
    await fixture.whenStable();

    const permissions = query('item-share-permissions-none-code');
    expect(permissions).toBeTruthy();
    const read = permissions!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(read.checked).toBe(true);
    expect(read.disabled).toBe(true);
    expect(read.getAttribute('aria-describedby')).toBe('item-share-read-required-none-code');
    expect(query('item-share-read-required-none-code')?.textContent).toContain('Message.ItemShareReadRequired');
  });

  it('drops an unselected new recipient without sending it', () => {
    component['onRecipientToggle']('none-code', true);
    component['onRecipientToggle']('none-code', false);
    component['onSave']();

    expect(api.saveCollectionItemShares).toHaveBeenCalledWith('omdb', 'tt1234567', 'library', [
      {
        sharedWithUserShareCode: 'selected-code',
      },
    ]);
  });

  it('reuses matching scope permissions without prompting or sending permission changes', async () => {
    component['onRecipientToggle']('later-code', true);
    await fixture.whenStable();

    expect(query('item-share-permissions-selected-code')).toBeNull();
    expect(query('item-share-permissions-later-code')).toBeNull();

    component['onRecipientToggle']('none-code', true);
    component['onPermissionToggle']('none-code', 'canCreate', true);
    component['onSave']();

    expect(api.saveCollectionItemShares).toHaveBeenCalledWith('omdb', 'tt1234567', 'library', [
      {
        sharedWithUserShareCode: 'selected-code',
      },
      {
        sharedWithUserShareCode: 'none-code',
        permissions: { canRead: true, canCreate: true, canUpdate: false, canDelete: false },
      },
      {
        sharedWithUserShareCode: 'later-code',
      },
    ]);
    expect(api.getCollectionItemShares).toHaveBeenCalledTimes(1);
    expect(api.getShares).toHaveBeenCalled();
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.ItemSharesSaved');
    expect(portal.closeTop).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('treats canonical refresh failure after PUT as committed success', async () => {
    api.getShares.mockReturnValue(throwError(() => new Error('refresh failed')));

    component['onSave']();
    await fixture.whenStable();

    expect(api.getCollectionItemShares).toHaveBeenCalledTimes(1);
    expect(collectionService.triggerReload).toHaveBeenCalled();
    expect(toastState.state.message()).toBe('Toast.ItemSharesSaved');
    expect(query('item-share-save-error')).toBeNull();
    expect(portal.closeTop).toHaveBeenCalled();
  });

  it('prevents duplicate saves while request is pending', () => {
    const pending = new Subject<void>();
    api.saveCollectionItemShares.mockReturnValue(pending);

    component['onSave']();
    component['onSave']();

    expect(api.saveCollectionItemShares).toHaveBeenCalledTimes(1);
  });

  it('keeps dialog open and displays an error when saving fails', async () => {
    api.saveCollectionItemShares.mockReturnValue(throwError(() => new Error('failed')));

    component['onSave']();
    await fixture.whenStable();

    expect(query('item-share-save-error')).toBeTruthy();
    expect(query('item-share-save-error')?.getAttribute('role')).toBe('alert');
    expect(portal.closeTop).not.toHaveBeenCalled();
    expect(collectionService.triggerReload).not.toHaveBeenCalled();
  });

  it('clears loading and prevents saving when loading shares fails', async () => {
    fixture.destroy();
    api.getCollectionItemShares.mockReturnValue(throwError(() => new Error('failed')));
    fixture = TestBed.createComponent(ItemShareDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('externalProvider', 'omdb');
    fixture.componentRef.setInput('externalItemId', 'tt1234567');
    fixture.componentRef.setInput('listType', 'library');
    fixture.componentRef.setInput('itemTitle', 'Movie');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['loading']()).toBe(false);
    expect(query('item-share-load-error')?.getAttribute('role')).toBe('alert');
    expect(query('item-share-save')).toBeNull();

    component['onSave']();
    expect(api.saveCollectionItemShares).not.toHaveBeenCalled();
  });

  it('directs an empty relationship state to established sharing settings', async () => {
    api.getCollectionItemShares.mockReturnValue(of([]));
    component['ngOnInit']();
    await fixture.whenStable();

    expect(query('item-share-empty')).toBeTruthy();
    component['onOpenSharingSettings']();
    expect(portal.closeAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/settings', 'shares']);
  });

  const query = (testId: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-test-id="${testId}"]`);

  const getCheckbox = (testId: string): HTMLInputElement =>
    query(testId)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
});
