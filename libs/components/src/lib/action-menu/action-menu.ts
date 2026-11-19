import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { ActionMenuActionModel } from './action-menu-model';

@Component({
  selector: 'libc-action-menu',
  templateUrl: './action-menu.html',
  styleUrl: './action-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenu {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private closingActions = false;
  private pendingAction: string | null = null;
  public readonly actions = input.required<ActionMenuActionModel[]>();
  public readonly testIdPrefix = input.required<string>();
  public readonly title = input.required<string>();
  public readonly selected = output<string>();
  protected readonly actionsOpen = signal(false);
  protected readonly regularActions = computed(() => this.actions().filter((action) => !action.destructive));
  protected readonly destructiveActions = computed(() => this.actions().filter((action) => action.destructive));
  protected readonly translations = {
    more: computed(() => this.ngxSignalTranslate.translate('More')),
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
  };

  protected openActions(dialog: HTMLDialogElement, trigger: HTMLButtonElement): void {
    if (this.closingActions || dialog.open) return;
    const bounds = trigger.getBoundingClientRect();
    const viewport = trigger.ownerDocument.documentElement;
    dialog.style.setProperty('--actions-right', `${Math.max(16, viewport.clientWidth - bounds.right)}px`);
    dialog.style.setProperty('--actions-bottom', `${Math.max(16, viewport.clientHeight - bounds.top + 8)}px`);
    trigger.focus();
    dialog.hidden = false;
    dialog.showModal();
    this.actionsOpen.set(true);
  }

  protected closeActions(dialog: HTMLDialogElement, action?: string): void {
    if (this.closingActions || !dialog.open) return;
    this.pendingAction = action ?? null;
    if (dialog.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.finishClosingActions(dialog);
      return;
    }
    this.closingActions = true;
    dialog.classList.add('actions-closing');
  }

  protected onActionsAnimationEnd(event: AnimationEvent, dialog: HTMLDialogElement): void {
    if (
      this.closingActions &&
      event.target === dialog &&
      !event.pseudoElement &&
      (event.animationName.endsWith('actions-popup-leave') || event.animationName.endsWith('actions-sheet-leave'))
    ) {
      this.finishClosingActions(dialog);
    }
  }

  private finishClosingActions(dialog: HTMLDialogElement): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    if (dialog.open) dialog.close();
    dialog.hidden = true;
    this.actionsOpen.set(false);
    dialog.classList.remove('actions-closing');
    this.closingActions = false;
    if (action !== null) this.selected.emit(action);
  }

  protected onActionsKeydown(event: KeyboardEvent, dialog: HTMLDialogElement): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeActions(dialog);
    }
  }

  protected onBackdropClick(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.closeActions(dialog);
    }
  }
}
