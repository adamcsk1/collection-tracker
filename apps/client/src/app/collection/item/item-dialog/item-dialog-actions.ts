import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OutputEmitterRef,
  signal,
} from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { ItemDialogTranslations } from '../item-form/item-form-model';

@Component({
  selector: 'ct-item-dialog-actions',
  templateUrl: './item-dialog-actions.html',
  styleUrl: './item-dialog-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialogActions {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private closingActions = false;
  private pendingAction: OutputEmitterRef<void> | null = null;
  protected readonly actionsOpen = signal(false);
  protected readonly actionTranslations = {
    finish: computed(() => this.ngxSignalTranslate.translate('ItemAction.Finish')),
    finished: computed(() => this.ngxSignalTranslate.translate('ItemAction.Finished')),
    favorite: computed(() => this.ngxSignalTranslate.translate('ItemAction.Favorite')),
    episodes: computed(() => this.ngxSignalTranslate.translate('ItemAction.Episodes')),
    more: computed(() => this.ngxSignalTranslate.translate('ItemAction.More')),
    title: computed(() => this.ngxSignalTranslate.translate('ItemAction.Title')),
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
  };
  protected readonly hasSecondaryActions = computed(
    () =>
      this.permissionUpdate() ||
      this.ownItem() ||
      this.permissionDelete() ||
      (this.trackingEnabled() &&
        ((this.permissionWatch() && this.ownershipItem() && (this.series() || this.book() || this.album())) ||
          (this.upNext() && (this.series() || this.book() || this.album()) && !this.inTracking())))
  );
  public readonly translations = input.required<ItemDialogTranslations>();
  public readonly editMode = input.required<boolean>();
  public readonly permissionUpdate = input.required<boolean>();
  public readonly permissionWatch = input.required<boolean>();
  public readonly permissionDelete = input.required<boolean>();
  public readonly tracking = input.required<boolean>();
  public readonly libraryItem = input.required<boolean>();
  public readonly ownershipItem = input.required<boolean>();
  public readonly upNext = input.required<boolean>();
  public readonly movie = input.required<boolean>();
  public readonly series = input.required<boolean>();
  public readonly book = input(false);
  public readonly album = input(false);
  public readonly finished = input.required<boolean>();
  public readonly favorite = input.required<boolean>();
  public readonly inTracking = input.required<boolean>();
  public readonly inFinished = input.required<boolean>();
  public readonly finishedEnabled = input.required<boolean>();
  public readonly trackingEnabled = input.required<boolean>();
  public readonly ownItem = input.required<boolean>();

  public readonly manageCompletedEpisodes = output<void>();
  public readonly manageSeriesMetadata = output<void>();
  public readonly markAsUnfinished = output<void>();
  public readonly markAsFinished = output<void>();
  public readonly copyToTracking = output<void>();
  public readonly removeFromTracking = output<void>();
  public readonly moveToFinished = output<void>();
  public readonly moveToTracking = output<void>();
  public readonly openInTracking = output<void>();
  public readonly removeFavorite = output<void>();
  public readonly markAsFavorite = output<void>();
  public readonly edit = output<void>();
  public readonly share = output<void>();
  public readonly delete = output<void>();

  protected openActions(dialog: HTMLDialogElement, trigger: HTMLButtonElement): void {
    if (this.closingActions) return;
    const bounds = trigger.getBoundingClientRect();
    const viewport = trigger.ownerDocument.documentElement;
    dialog.style.setProperty('--actions-right', `${Math.max(16, viewport.clientWidth - bounds.right)}px`);
    dialog.style.setProperty('--actions-bottom', `${Math.max(16, viewport.clientHeight - bounds.top + 8)}px`);
    trigger.focus();
    dialog.hidden = false;
    dialog.showModal();
    this.actionsOpen.set(true);
  }

  protected closeActions(dialog: HTMLDialogElement, action?: OutputEmitterRef<void>): void {
    if (this.closingActions) return;
    this.pendingAction = action ?? null;
    if (!dialog.open || dialog.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    action?.emit();
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
