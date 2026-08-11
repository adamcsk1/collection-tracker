import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from './share-dialog';

describe('ShareDialog', () => {
  let fixture: ComponentFixture<ShareDialog>;
  let component: ShareDialog;
  let portal: { closeTop: ReturnType<typeof vi.fn> };
  let saved: ReturnType<typeof vi.fn>;
  let confirm: { open: ReturnType<typeof vi.fn> };
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    portal = { closeTop: vi.fn() };
    saved = vi.fn();
    confirm = { open: vi.fn(() => of(true)) };
    TestBed.configureTestingModule({
      imports: [ShareDialog],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    });
    trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    fixture = TestBed.createComponent(ShareDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('saved', saved);
  });

  afterEach(() => trigger.remove());

  it('starts a new share with library read grants', () => {
    fixture.detectChanges();

    expect(component['grants']()).toHaveLength(2);
    expect(component['grants']().every((grant) => grant.readMode === 'all')).toBe(true);
    expect(component['editing']()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-test-id="share-dialog-list-library"] summary').textContent
    ).toContain('Library');
  });

  it('requires a share code before saving a new share', () => {
    fixture.detectChanges();
    component['onSave']();

    expect(saved).not.toHaveBeenCalled();
  });

  it('saves a new share code and closes the dialog', () => {
    fixture.detectChanges();
    component['shareCodeModel'].set({ sharedWithUserShareCode: ' share-code ' });
    component['onSave']();

    expect(saved).toHaveBeenCalledWith('share-code', component['grants']());
    expect(portal.closeTop).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('clones existing grants into an edit draft', () => {
    fixture.componentRef.setInput('share', {
      sharedWithUserShareCode: 'share-code',
      sharedWithUsername: 'Shared User',
      grants: [
        {
          listType: 'library',
          contentType: 'movie',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          readMode: 'all',
        },
      ],
    });
    fixture.detectChanges();
    component['onGrantToggle']('library', 'movie', 'canUpdate', true);

    expect(component['grants']()).toEqual([
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    expect(component.share()?.grants[0].canUpdate).toBe(false);
    expect(component['permissionChanged']('library', 'movie', 'canUpdate')).toBe(true);
  });

  it('enables view when a child permission is enabled', () => {
    fixture.detectChanges();
    component['onGrantToggle']('wishlist', 'movie', 'canCreate', true);

    expect(component['grantChecked']('wishlist', 'movie', 'canRead')).toBe(true);
    expect(component['grantChecked']('wishlist', 'movie', 'canCreate')).toBe(true);
    expect(component['permissionChangeAnnouncement']()).toBe('Message.ShareGrantViewEnabled');
  });

  it('clears child permissions when view is disabled', () => {
    fixture.detectChanges();
    component['onGrantToggle']('library', 'movie', 'canUpdate', true);
    component['onGrantToggle']('library', 'movie', 'canDelete', true);
    component['onGrantToggle']('library', 'movie', 'canRead', false);

    expect(component['grantChecked']('library', 'movie', 'canRead')).toBe(false);
    expect(component['grantChecked']('library', 'movie', 'canUpdate')).toBe(false);
    expect(component['grantChecked']('library', 'movie', 'canDelete')).toBe(false);
    expect(component['permissionChangeAnnouncement']()).toBe('Message.ShareGrantChildrenCleared');
  });

  it('renders all mode as checked and selected mode as indeterminate', () => {
    fixture.componentRef.setInput('share', {
      sharedWithUserShareCode: 'share-code',
      sharedWithUsername: 'Shared User',
      grants: [
        {
          listType: 'library',
          contentType: 'movie',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          readMode: 'all',
        },
        {
          listType: 'library',
          contentType: 'series',
          canRead: true,
          canCreate: false,
          canUpdate: true,
          canDelete: false,
          readMode: 'selected',
        },
      ],
    });
    fixture.detectChanges();

    const all = fixture.nativeElement.querySelector(
      '[data-test-id="share-dialog-grant-library-movie-can-read"] input'
    ) as HTMLInputElement;
    const selected = fixture.nativeElement.querySelector(
      '[data-test-id="share-dialog-grant-library-series-can-read"] input'
    ) as HTMLInputElement;
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    expect(selected.checked).toBe(false);
    expect(selected.indeterminate).toBe(true);
    expect(selected.getAttribute('aria-checked')).toBe('mixed');
    const clearSelected = fixture.nativeElement.querySelector(
      '[data-test-id="share-dialog-grant-library-series-clear-selected"]'
    ) as HTMLButtonElement;
    expect(clearSelected.type).toBe('button');
    expect(clearSelected.textContent).toContain('ClearSelectedItemAccess');
    expect(component['grantChecked']('library', 'series', 'canUpdate')).toBe(true);
  });

  it('confirms selected to all and preserves selected mode when declined', () => {
    fixture.componentRef.setInput('share', selectedShare());
    fixture.detectChanges();
    confirm.open.mockReturnValueOnce(of(false));

    component['onReadToggle']('library', 'movie', true);

    expect(component['readIndeterminate']('library', 'movie')).toBe(true);

    confirm.open.mockReturnValueOnce(of(true));
    component['onReadToggle']('library', 'movie', true);
    expect(component['grantChecked']('library', 'movie', 'canRead')).toBe(true);
    expect(component['readIndeterminate']('library', 'movie')).toBe(false);
  });

  it('confirms direct selected access removal and preserves it when declined', () => {
    fixture.componentRef.setInput('share', selectedShare());
    fixture.detectChanges();
    confirm.open.mockReturnValueOnce(of(false));

    component['onClearSelected']('library', 'movie');
    expect(component['readIndeterminate']('library', 'movie')).toBe(true);

    confirm.open.mockReturnValueOnce(of(true));
    component['onClearSelected']('library', 'movie');
    expect(component['grantChecked']('library', 'movie', 'canRead')).toBe(false);
    expect(component['grants']()).toEqual([]);
  });

  it('allows an existing relationship to save empty grants', () => {
    fixture.componentRef.setInput('share', selectedShare());
    fixture.detectChanges();
    component['onClearSelected']('library', 'movie');

    expect(component['valid']()).toBe(true);
    component['onSave']();
    expect(saved).toHaveBeenCalledWith('share-code', []);
  });

  it('saves a new zero-grant relationship with a valid share code', () => {
    fixture.detectChanges();
    component['grants'].set([]);
    component['shareCodeModel'].set({ sharedWithUserShareCode: ' recipient-code ' });

    expect(component['valid']()).toBe(true);
    component['onSave']();

    expect(saved).toHaveBeenCalledWith('recipient-code', []);
  });

  it('keeps a new zero-grant relationship disabled with an invalid share code', () => {
    fixture.detectChanges();
    component['grants'].set([]);

    expect(component['valid']()).toBe(false);
    expect(
      (fixture.nativeElement.querySelector('[data-test-id="share-dialog-save"]') as HTMLButtonElement).disabled
    ).toBe(true);
    component['onSave']();
    expect(saved).not.toHaveBeenCalled();
  });

  it('clears the announcement when no permission cascade occurs', () => {
    fixture.detectChanges();
    component['onGrantToggle']('wishlist', 'movie', 'canCreate', true);
    component['onGrantToggle']('library', 'movie', 'canUpdate', true);

    expect(component['permissionChangeAnnouncement']()).toBe('');

    component['onGrantToggle']('wishlist', 'series', 'canRead', false);

    expect(component['permissionChangeAnnouncement']()).toBe('');
  });

  it('renders an incoming share as read-only', () => {
    fixture.componentRef.setInput('share', {
      ownerUserShareCode: 'owner-code',
      ownerUsername: 'Owner',
      grants: [
        {
          listType: 'library',
          contentType: 'movie',
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          readMode: 'all',
        },
      ],
    });
    fixture.detectChanges();

    expect(component['readOnly']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test-id="share-dialog-save"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="share-dialog-dependency"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')?.disabled).toBe(true);
  });
});

const selectedShare = () => ({
  sharedWithUserShareCode: 'share-code',
  sharedWithUsername: 'Shared User',
  grants: [
    {
      listType: 'library' as const,
      contentType: 'movie' as const,
      canRead: true,
      canCreate: false,
      canUpdate: true,
      canDelete: false,
      readMode: 'selected' as const,
    },
  ],
});
