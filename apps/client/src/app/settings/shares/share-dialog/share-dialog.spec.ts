import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareDialog } from './share-dialog';

describe('ShareDialog', () => {
  let fixture: ComponentFixture<ShareDialog>;
  let component: ShareDialog;
  let portal: { closeTop: ReturnType<typeof vi.fn> };
  let saved: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    portal = { closeTop: vi.fn() };
    saved = vi.fn();
    TestBed.configureTestingModule({
      imports: [ShareDialog],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
      ],
    });
    fixture = TestBed.createComponent(ShareDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('saved', saved);
  });

  it('starts a new share with library read grants', () => {
    fixture.detectChanges();

    expect(component['grants']()).toHaveLength(2);
    expect(component['editing']()).toBe(false);
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
        },
      ],
    });
    fixture.detectChanges();
    component['onGrantToggle']('library', 'movie', 'canUpdate', true);

    expect(component['grants']()).toEqual([
      { listType: 'library', contentType: 'movie', canRead: true, canCreate: false, canUpdate: true, canDelete: false },
    ]);
    expect(component.share()?.grants[0].canUpdate).toBe(false);
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
        },
      ],
    });
    fixture.detectChanges();

    expect(component['readOnly']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-test-id="share-dialog-save"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')?.disabled).toBe(true);
  });
});
