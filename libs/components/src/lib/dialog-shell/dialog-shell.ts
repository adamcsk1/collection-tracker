import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { asyncScheduler, timer } from 'rxjs';

let nextDialogShellActionsMenuId = 0;
const closeAnimationDuration = 200;
const dragCloseThreshold = 32;
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

@Component({
  selector: 'libc-dialog-shell',
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShell implements AfterViewInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly dialogRoot = viewChild<ElementRef<HTMLDivElement>>('dialogRoot');
  private readonly menuContent = viewChild<ElementRef<HTMLDivElement>>('menuContent');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly menuContainer = viewChild<ElementRef<HTMLDivElement>>('menuContainer');
  private dragStartY: number | null = null;
  private dragPointerId: number | null = null;
  private previouslyFocusedElement: HTMLElement | null = null;
  public readonly closeWithPortal = input(true);
  public readonly closed = output<void>();
  protected readonly hasMenuContent = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly closing = signal(false);
  protected readonly dragOffset = signal(0);
  protected readonly dragOffsetCss = computed(() => `${this.dragOffset()}px`);
  protected readonly dragFrameTransform = computed(() => {
    const offset = this.dragOffset();
    return offset > 0 ? `translateY(${offset}px)` : null;
  });
  protected readonly actionsMenuId = `dialog-shell-actions-menu-${nextDialogShellActionsMenuId++}`;

  protected readonly translations = {
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
    dragToClose: computed(() => this.ngxSignalTranslate.translate('DragToClose')),
    moreActions: computed(() => this.ngxSignalTranslate.translate('MoreActions')),
  };

  constructor() {
    const onDocumentClick = (event: MouseEvent): void => {
      if (!this.menuOpen()) return;
      const button = this.menuButton()?.nativeElement;
      const menu = this.menuContainer()?.nativeElement;
      if (button && !button.contains(event.target as Node) && menu && !menu.contains(event.target as Node)) {
        this.menuOpen.set(false);
      }
    };
    this.document.addEventListener('click', onDocumentClick);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('click', onDocumentClick));
  }

  public ngAfterViewInit(): void {
    this.previouslyFocusedElement =
      this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
    this.dialogRoot()?.nativeElement.focus();

    const menuContentElement = this.menuContent()?.nativeElement;
    if (menuContentElement) {
      const updateHasMenuContent = (): void => {
        const hasActions = Boolean(menuContentElement.childElementCount);
        this.hasMenuContent.set(hasActions);
        if (!hasActions) {
          this.menuOpen.set(false);
        }
      };
      updateHasMenuContent();
      const observer = new MutationObserver(updateHasMenuContent);
      observer.observe(menuContentElement, { childList: true });
      this.destroyRef.onDestroy(() => observer.disconnect());
    }
  }

  protected onToggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  protected onMenuContentClick(): void {
    this.menuOpen.set(false);
  }

  protected onClose(): void {
    if (this.closing()) return;
    this.menuOpen.set(false);
    this.closing.set(true);
    timer(closeAnimationDuration, asyncScheduler)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.previouslyFocusedElement?.focus();
        this.closed.emit();
        if (this.closeWithPortal()) this.portal.close();
      });
  }

  public onTrapFocus(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const focusableElements = this.getFocusableElements();
    if (!focusableElements.length) {
      event.preventDefault();
      this.dialogRoot()?.nativeElement.focus();
      return;
    }

    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];
    const activeElement = this.document.activeElement;
    if (keyboardEvent.shiftKey && activeElement === firstFocusableElement) {
      event.preventDefault();
      lastFocusableElement.focus();
    } else if (!keyboardEvent.shiftKey && activeElement === lastFocusableElement) {
      event.preventDefault();
      firstFocusableElement.focus();
    }
  }

  protected onDragHandlePointerDown(event: PointerEvent): void {
    this.dragStartY = event.clientY;
    this.dragPointerId = event.pointerId;
    this.dragOffset.set(0);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected onDragHandlePointerMove(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId || this.dragStartY === null) return;

    this.dragOffset.set(Math.max(0, event.clientY - this.dragStartY));
  }

  protected onDragHandlePointerUp(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId || this.dragStartY === null) return;

    const dragDistance = Math.max(0, event.clientY - this.dragStartY);
    this.dragOffset.set(dragDistance);
    this.dragStartY = null;
    this.dragPointerId = null;
    if (dragDistance >= dragCloseThreshold) {
      this.onClose();
    } else {
      this.dragOffset.set(0);
    }
  }

  protected onDragHandlePointerCancel(): void {
    this.dragStartY = null;
    this.dragPointerId = null;
    this.dragOffset.set(0);
  }

  private getFocusableElements(): HTMLElement[] {
    const dialogRoot = this.dialogRoot()?.nativeElement;
    if (!dialogRoot) return [];

    return Array.from(dialogRoot.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.closest('[hidden]')
    );
  }
}
