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

const FOCUSABLE_SEARCH_SELECTOR = 'button[data-test-id="ai-search-trigger"], input, textarea, select, button';

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
  protected readonly service = inject(FloatActionsService);
  private readonly searchContent = viewChild<ElementRef<HTMLElement>>('searchContent');
  private readonly searchFocusRequest = signal(0);
  private previousSearchTemplate: unknown = null;

  protected readonly translations = {
    menu: computed(() => this.ngxSignalTranslate.translate('Menu')),
    search: computed(() => this.ngxSignalTranslate.translate('Search')),
    scrollToTop: computed(() => this.ngxSignalTranslate.translate('ScrollToTop')),
  };
  protected readonly config = this.service.config;
  protected readonly searchTemplate = this.service.searchTemplate;
  protected readonly searchActionAvailable = this.service.searchActionAvailable;
  protected readonly actionsComponent = this.service.actionsComponent;
  protected readonly actionButtonsVisible = this.service.actionButtonsVisible;
  protected readonly searchExpanded = signal(false);
  protected readonly searchAvailable = computed(() => !!this.searchTemplate() || this.searchActionAvailable());
  protected readonly showFloatActions = computed(() => this.config().actionsAvailable && !!this.actionsComponent());
  protected readonly showMenuOnlyBar = computed(() => !this.searchAvailable() && !this.showFloatActions());

  constructor() {
    effect(() => {
      const searchTemplate = this.searchTemplate();
      if (this.previousSearchTemplate === searchTemplate) return;

      this.previousSearchTemplate = searchTemplate;
      this.searchExpanded.set(false);
    });

    effect(() => {
      if (this.config().scrolling && this.searchExpanded()) {
        this.searchExpanded.set(false);
      }
    });

    effect(() => {
      const searchFocusRequest = this.searchFocusRequest();
      const searchContent = this.searchContent();
      if (!searchFocusRequest || !searchContent) return;

      queueMicrotask(() => this.focusSearchControl());
    });
  }

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }

  protected onShowSearch(): void {
    if (this.searchActionAvailable()) {
      this.service.triggerSearchAction();
      return;
    }

    this.searchExpanded.set(true);
    this.searchFocusRequest.update((request) => request + 1);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.searchExpanded()) return;
    if (this.elementRef.nativeElement.contains(event.target as Node)) return;

    this.searchExpanded.set(false);
  }

  protected onScrollToTop(): void {
    this.service.scrollToTop();
  }

  private focusSearchControl(): void {
    const searchContentElement = this.searchContent()?.nativeElement;
    const focusableElement = searchContentElement?.querySelector<HTMLElement>(FOCUSABLE_SEARCH_SELECTOR);
    if (!focusableElement) return;

    focusableElement.focus();
    if (focusableElement.matches('[data-test-id="ai-search-trigger"]')) {
      focusableElement.click();
    }
  }
}
