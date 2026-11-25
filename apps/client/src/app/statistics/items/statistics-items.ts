import { DatePipe, DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import type {
  CollectionItemApiModel,
  CollectionItemFiltersApiModel,
  CollectionItemsPageModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { catchError, EMPTY, expand, reduce, switchMap } from 'rxjs';
import { mainCollectionStateToken } from '../../main/main-collection-store';

import { initialItemsState, itemsStateToken } from './statistics-items-store';

@Component({
  selector: 'ct-statistics-items',
  imports: [DatePipe],
  templateUrl: './statistics-items.html',
  styleUrl: './statistics-items.css',
  providers: [provideStore(initialItemsState, itemsStateToken)],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsItems {
  public readonly filters = input.required<CollectionItemFiltersApiModel>();
  public readonly title = input.required<string>();
  public readonly changed = output<void>();
  protected readonly store = inject(itemsStateToken);
  private readonly api = inject(ApiService);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mainCollection = inject(mainCollectionStateToken);
  private readonly document = inject(DOCUMENT);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private openedDialog = false;
  private openingDialog = false;
  private hasDialogChanges: () => boolean = () => false;
  protected readonly translations = {
    loading: computed(() => this.ngxSignalTranslate.translate('Message.LoadStatistics')),
    empty: computed(() => this.ngxSignalTranslate.translate('Statistics.NoItems')),
    error: computed(() => this.ngxSignalTranslate.translate('Toast.LoadStatisticsError')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    more: computed(() => this.ngxSignalTranslate.translate('Statistics.LoadMore')),
    media: computed(() => ({
      movie: this.ngxSignalTranslate.translate('Movies'),
      series: this.ngxSignalTranslate.translate('Series'),
      book: this.ngxSignalTranslate.translate('Books'),
      album: this.ngxSignalTranslate.translate('Music'),
    })),
  };

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => {
        this.store.setState('items', []);
        this.store.setState('nextCursor', null);
        this.store.setState('cursor', null);
        this.store.setState('restoreCount', 50);
        this.retry();
      });
    });
    toObservable(
      computed(() => ({
        filters: this.filters(),
        cursor: this.store.state.cursor(),
        revision: this.store.state.revision(),
      }))
    )
      .pipe(
        switchMap(({ filters, cursor }) => {
          this.store.setState('status', 'pending');
          const pageFilters = { ...filters, orderBy: 'alphabet' as const, orderDirection: 'asc' as const };
          const restoreCount = this.store.state.restoreCount();
          return this.api.searchItems(pageFilters, cursor, 50).pipe(
            expand((page, pageIndex) =>
              !cursor && page.page.nextCursor && (pageIndex + 1) * 50 < restoreCount
                ? this.api.searchItems(pageFilters, page.page.nextCursor, 50)
                : EMPTY
            ),
            reduce((previous, page) => ({ items: [...previous.items, ...page.items], page: page.page })),
            catchError(() => {
              this.store.setState('status', 'error');
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page: CollectionItemsPageModel) => {
        const focused = this.document.activeElement;
        const restoreFocus = focused instanceof HTMLElement && this.elementRef.nativeElement.contains(focused);
        this.store.setState(
          'items',
          this.store.state.cursor() ? [...this.store.state.items(), ...page.items] : page.items
        );
        this.store.setState('nextCursor', page.page.nextCursor);
        this.store.setState('status', 'finished');
        if (restoreFocus)
          afterNextRender(
            () => {
              if (!focused.isConnected)
                this.elementRef.nativeElement
                  .querySelector<HTMLElement>('[data-test-id="statistics-items-heading"]')
                  ?.focus();
            },
            { injector: this.injector }
          );
      });
    effect(() => {
      const dialog = this.portal.componentRef();
      if (!dialog && this.openedDialog) {
        this.openedDialog = false;
        untracked(() => {
          if (this.hasDialogChanges()) {
            this.changed.emit();
            this.reload();
          }
        });
      }
    });
  }

  protected more(): void {
    this.store.setState('cursor', this.store.state.nextCursor());
  }
  protected retry(): void {
    this.store.setState('revision', this.store.state.revision() + 1);
  }
  private reload(): void {
    this.store.setState('restoreCount', Math.max(50, this.store.state.items().length));
    this.store.setState('cursor', null);
    this.retry();
  }
  protected async open(item: CollectionItemApiModel): Promise<void> {
    if (this.openingDialog || this.openedDialog) return;
    this.openingDialog = true;
    try {
      const { ItemDialog } = await import('../../collection/item/item-dialog/item-dialog');
      if (this.destroyRef.destroyed) return;
      const revision = this.mainCollection.state.reloadTrigger();
      const snapshot = JSON.stringify(item);
      this.portal.openStacked(ItemDialog, { collectionItem: item });
      const instance = this.portal.componentRef()?.instance;
      this.hasDialogChanges = () =>
        this.mainCollection.state.reloadTrigger() !== revision ||
        (instance instanceof ItemDialog && JSON.stringify(instance.collectionItem()) !== snapshot);
      this.openedDialog = true;
    } finally {
      this.openingDialog = false;
    }
  }
}
