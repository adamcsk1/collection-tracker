import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageDialog } from '@components/message-dialog/message-dialog';
import { PortalService } from '@services/portal-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectionRoutes } from '../../collection-routes';
import { ItemDialog } from './item-dialog';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';

@Component({ selector: 'ct-draft-route-test', imports: [RouterOutlet], template: '<router-outlet />' })
class DraftRouteTest {}

describe('itemDraftGuard', () => {
  let dialog: ItemDialog;
  let canDiscard: ReturnType<typeof vi.fn>;
  let portal: { componentRef: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    canDiscard = vi.fn().mockResolvedValue(false);
    dialog = Object.assign(Object.create(ItemDialog.prototype), { canDiscard });
    portal = { componentRef: vi.fn(() => ({ instance: dialog })), close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: PortalService, useValue: portal },
        provideRouter([
          {
            ...collectionRoutes[0],
            path: 'collection',
            component: DraftRouteTest,
            children: [
              { path: 'library', component: DraftRouteTest },
              { path: 'tracking', component: DraftRouteTest },
            ],
          },
          { path: 'about', component: DraftRouteTest },
        ]),
      ],
    });
  });

  it.each(['/collection/library', '/collection/tracking', '/about'])(
    'preserves the item URL when navigation to %s is cancelled, then allows confirmed discard',
    async (destination) => {
      const harness = await RouterTestingHarness.create('/collection/library?item=omdb:tt1234567');
      const router = TestBed.inject(Router);
      await harness.navigateByUrl(destination);
      expect(router.url).toBe('/collection/library?item=omdb:tt1234567');
      expect(canDiscard).toHaveBeenCalledOnce();

      canDiscard.mockResolvedValue(true);
      await harness.navigateByUrl(destination);
      expect(router.url).toBe(destination);
      expect(canDiscard).toHaveBeenCalledTimes(2);
    }
  );

  it('allows navigation without an item dialog', async () => {
    const harness = await RouterTestingHarness.create('/collection/library');
    portal.componentRef.mockReturnValue(null);
    await harness.navigateByUrl('/about');
    expect(TestBed.inject(Router).url).toBe('/about');
    expect(canDiscard).not.toHaveBeenCalled();
  });

  it('guards additions when leaving the collection', async () => {
    const harness = await RouterTestingHarness.create('/collection/library');
    const host = document.createElement('div');
    portal.componentRef.mockReturnValue({
      instance: Object.assign(Object.create(NewItemDialog.prototype), { canDiscard }),
      location: { nativeElement: host },
    });
    await harness.navigateByUrl('/about');
    expect(TestBed.inject(Router).url).toBe('/collection/library');
    expect(canDiscard).toHaveBeenCalledOnce();
    expect(portal.close).not.toHaveBeenCalled();
    canDiscard.mockResolvedValue(true);
    await harness.navigateByUrl('/about');
    expect(TestBed.inject(Router).url).toBe('/about');
    expect(portal.close).toHaveBeenCalledExactlyOnceWith(host);
  });

  it('blocks repeated navigation while a message dialog is on top', async () => {
    const harness = await RouterTestingHarness.create('/collection/library?item=omdb:tt1234567');
    canDiscard.mockImplementation(() => {
      portal.componentRef.mockReturnValue({ instance: Object.create(MessageDialog.prototype) });
      return new Promise<boolean>(() => undefined);
    });
    const firstNavigation = harness.navigateByUrl('/collection/library');
    await vi.waitFor(() => expect(canDiscard).toHaveBeenCalledOnce());
    await harness.navigateByUrl('/about');
    await firstNavigation;
    expect(TestBed.inject(Router).url).toBe('/collection/library?item=omdb:tt1234567');
    expect(canDiscard).toHaveBeenCalledOnce();
  });
});
