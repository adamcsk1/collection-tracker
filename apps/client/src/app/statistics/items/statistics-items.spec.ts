import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import type { CollectionItemsPageModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { StatisticsItems } from './statistics-items';

vi.mock('../../collection/item/item-dialog/item-dialog', () => ({ ItemDialog: class {} }));
const item = {
  title: 'Title',
  titleLower: 'title',
  image: '',
  genre: [],
  externalProvider: 'omdb' as const,
  externalItemId: 'tt123',
  tags: [],
  year: null,
  rate: '',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  actors: '',
  plot: '',
  hash: 'hash',
  listType: 'tracking' as const,
  contentType: 'movie' as const,
  favorite: false,
  watchedAt: '2026-02-01',
  ownerShareCode: 'owner',
};
const page: CollectionItemsPageModel = { items: [item], page: { limit: 50, hasMore: false, nextCursor: null } };
describe('StatisticsItems', () => {
  const create = (searchItems = vi.fn(() => of(page))) => {
    const componentRef = signal<unknown>(null);
    const portal = { componentRef, openStacked: vi.fn(() => componentRef.set({})) };
    TestBed.configureTestingModule({
      imports: [StatisticsItems],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        { provide: ApiService, useValue: { searchItems } },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(StatisticsItems);
    fixture.componentRef.setInput('title', 'Completed');
    fixture.componentRef.setInput('filters', { activityYear: 2026, activityStatus: 'completed' });
    return { fixture, portal };
  };
  it('loads titles in bounded pages and resets pagination on filter change', async () => {
    const api = vi
      .fn()
      .mockReturnValueOnce(of({ ...page, page: { limit: 50, hasMore: true, nextCursor: 'cursor' } }))
      .mockReturnValue(of({ ...page, items: [{ ...item, externalItemId: 'tt456', title: 'Other title' }] }));
    const { fixture } = create(api);
    await fixture.whenStable();
    fixture.componentInstance['more']();
    await fixture.whenStable();
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ activityYear: 2026 }), 'cursor', 50);
    expect(fixture.componentInstance['store'].state.items()).toHaveLength(2);
    fixture.componentRef.setInput('filters', { activityYear: 2025, activityStatus: 'completed' });
    await fixture.whenStable();
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ activityYear: 2025 }), null, 50);
    expect(fixture.componentInstance['store'].state.items()).toHaveLength(1);
  });
  it('opens existing details once and refreshes changes after closing without losing filters', async () => {
    const api = vi.fn(() => of(page));
    const { fixture, portal } = create(api);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    await fixture.whenStable();
    await Promise.all([fixture.componentInstance['open'](item), fixture.componentInstance['open'](item)]);
    expect(portal.openStacked).toHaveBeenCalledWith(expect.any(Function), { collectionItem: item });
    expect(portal.openStacked).toHaveBeenCalledOnce();
    await fixture.whenStable();
    TestBed.inject(mainCollectionStateToken).setState('reloadTrigger', 1);
    portal.componentRef.set(null);
    await fixture.whenStable();
    expect(changed).toHaveBeenCalledOnce();
    expect(api).toHaveBeenLastCalledWith(
      expect.objectContaining({ activityYear: 2026, activityStatus: 'completed' }),
      null,
      50
    );
  });
  it('does not reload unchanged dialogs or discard loaded pages', async () => {
    const api = vi.fn(() => of(page));
    const { fixture, portal } = create(api);
    await fixture.whenStable();
    const requestsBeforeOpen = api.mock.calls.length;
    await fixture.componentInstance['open'](item);
    await fixture.whenStable();
    portal.componentRef.set(null);
    await fixture.whenStable();
    expect(api).toHaveBeenCalledTimes(requestsBeforeOpen);
  });
  it('restores the loaded depth after edits and provides focus fallback when the title disappears', async () => {
    const firstPage: CollectionItemsPageModel = {
      items: Array.from({ length: 50 }, (_, index) => ({
        ...item,
        title: `Title ${index}`,
        externalItemId: `tt${index}`,
      })),
      page: { limit: 50, hasMore: true, nextCursor: 'next' },
    };
    const secondPage: CollectionItemsPageModel = { ...page, items: [{ ...item, externalItemId: 'tt51' }] };
    const api = vi
      .fn()
      .mockReturnValueOnce(of(firstPage))
      .mockReturnValueOnce(of(secondPage))
      .mockReturnValueOnce(of(firstPage))
      .mockReturnValueOnce(of(secondPage));
    const { fixture, portal } = create(api);
    await fixture.whenStable();
    fixture.componentInstance['more']();
    await fixture.whenStable();
    await fixture.componentInstance['open'](secondPage.items[0]);
    await fixture.whenStable();
    TestBed.inject(mainCollectionStateToken).setState('reloadTrigger', 1);
    portal.componentRef.set(null);
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.items()).toHaveLength(51);
    expect(api).toHaveBeenCalledTimes(4);
    const host: HTMLElement = fixture.nativeElement;
    const origin = host.querySelectorAll<HTMLButtonElement>('[data-test-id="statistics-item"]')[50];
    origin.focus();
    api.mockReturnValue(of({ ...firstPage, page: { limit: 50, hasMore: false, nextCursor: null } }));
    await fixture.componentInstance['open'](secondPage.items[0]);
    await fixture.whenStable();
    TestBed.inject(mainCollectionStateToken).setState('reloadTrigger', 2);
    portal.componentRef.set(null);
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.items()).toHaveLength(50);
    expect(document.activeElement).toBe(host.querySelector('[data-test-id="statistics-items-heading"]'));
  });
  it('cancels stale requests and retries errors', async () => {
    const stale = new Subject<CollectionItemsPageModel>();
    const api = vi
      .fn()
      .mockReturnValueOnce(stale)
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of(page));
    const { fixture } = create(api);
    await fixture.whenStable();
    fixture.componentRef.setInput('filters', { activityYear: 2025, activityStatus: 'completed' });
    await fixture.whenStable();
    stale.next(page);
    expect(fixture.componentInstance['store'].state.status()).toBe('error');
    fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.items()).toHaveLength(1);
  });
});
