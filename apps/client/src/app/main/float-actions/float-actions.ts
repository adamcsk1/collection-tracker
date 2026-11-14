import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { MenuDialog } from '../menu-dialog/menu-dialog';
import { FloatActionsService } from './float-actions-service';

@Component({
  selector: 'ct-float-actions',
  templateUrl: './float-actions.html',
  styleUrl: './float-actions.css',
  imports: [NgComponentOutlet, NgTemplateOutlet],
  host: {
    '[class.float-actions-scrolling]': 'config().scrolling',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatActions {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly searchContent = viewChild<ElementRef<HTMLElement>>('searchContent');
  private readonly searchOpened = signal(false);
  private readonly searchFocusRequest = signal(0);
  protected readonly service = inject(FloatActionsService);

  protected readonly translations = {
    pageControls: computed(() => this.ngxSignalTranslate.translate('PageControls')),
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    aiSearch: computed(() => this.ngxSignalTranslate.translate('AiSearch')),
    scrollToTop: computed(() => this.ngxSignalTranslate.translate('ScrollToTop')),
  };
  protected readonly config = this.service.config;
  protected readonly searchTemplate = this.service.searchTemplate;
  protected readonly searchActionAvailable = this.service.searchActionAvailable;
  protected readonly aiSearchAvailable = this.service.aiSearchAvailable;
  protected readonly aiSearchActive = this.service.aiSearchActive;
  protected readonly actionsComponent = this.service.actionsComponent;
  protected readonly actionButtonsVisible = this.service.actionButtonsVisible;
  protected readonly searchExpanded = computed(
    () => !!this.searchTemplate() && (this.searchOpened() || this.service.searchActive())
  );
  protected readonly searchAvailable = computed(() => !!this.searchTemplate() || this.searchActionAvailable());
  protected readonly showFloatActions = computed(() => this.config().actionsAvailable && !!this.actionsComponent());
  protected readonly showMenuOnlyBar = computed(
    () => !this.searchAvailable() && !this.aiSearchAvailable() && !this.showFloatActions()
  );

  constructor() {
    effect(() => {
      this.searchTemplate();
      this.searchOpened.set(false);
      this.searchFocusRequest.set(0);
    });

    effect(() => {
      if (this.config().scrolling) this.searchOpened.set(false);
    });

    effect(() => {
      const request = this.service.searchFocusRequest();
      if (!request) return;
      this.searchOpened.set(true);
      this.searchFocusRequest.set(request);
    });

    effect(() => {
      const focusRequest = this.searchFocusRequest();
      const searchContent = this.searchContent();
      if (!focusRequest || !searchContent) return;

      queueMicrotask(() => {
        this.searchFocusRequest.set(0);
        if (this.searchContent() !== searchContent) return;
        searchContent.nativeElement.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
      });
    });
  }

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }

  protected onShowSearch(): void {
    this.service.focusSearch();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.elementRef.nativeElement.contains(event.target as Node)) return;
    this.searchOpened.set(false);
  }

  protected onOpenAiSearch(): void {
    this.service.triggerAiSearchAction();
  }

  protected onScrollToTop(): void {
    this.service.scrollToTop();
  }
}
