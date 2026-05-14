import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { describe, expect, it, vi } from 'vitest';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { Wishlist } from './wishlist';

describe('Wishlist', () => {
  it('opens the wishlist dialog from the empty CTA', () => {
    const portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Wishlist],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    TestBed.overrideComponent(Wishlist, { set: { template: '' } });
    const fixture: ComponentFixture<Wishlist> = TestBed.createComponent(Wishlist);
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddWishlist'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { wishlist: true });
  });
});
