import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MessageDialogRequest } from '@services/message-dialog-model';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { DialogShell } from '../dialog-shell/dialog-shell';
import { Input } from '../input/input';

@Component({
  selector: 'libc-message-dialog',
  imports: [DialogShell, Input, FormField],
  templateUrl: './message-dialog.html',
  styleUrl: './message-dialog.css',
  host: { class: 'dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageDialog implements OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private settled = false;
  public readonly request = input.required<MessageDialogRequest>();
  protected readonly titleId = `message-dialog-title-${crypto.randomUUID()}`;
  protected readonly messageId = `message-dialog-message-${crypto.randomUUID()}`;
  protected readonly confirmationValue = signal('');
  protected readonly confirmationForm = form(this.confirmationValue);
  protected readonly destructive = computed(() => this.request().options.destructive === true);
  protected readonly confirmationText = computed(() => {
    const options = this.request().options;
    return options.destructive ? options.confirmationText : '';
  });
  protected readonly canConfirm = computed(
    () =>
      !this.destructive() ||
      (this.confirmationText().length > 0 && this.confirmationValue() === this.confirmationText())
  );
  protected readonly translations = {
    title: computed(() => {
      if (this.request().options.title) return this.request().options.title;
      switch (this.request().mode) {
        case 'alert':
          return this.ngxSignalTranslate.translate('Dialog.Alert');
        case 'info':
          return this.ngxSignalTranslate.translate('Dialog.Info');
        case 'confirm':
          return this.ngxSignalTranslate.translate('Dialog.ConfirmTitle');
      }
    }),
    cancel: computed(() => this.ngxSignalTranslate.translate('Dialog.Cancel')),
    action: computed(
      () =>
        this.request().options.actionLabel ??
        this.ngxSignalTranslate.translate(this.request().mode === 'confirm' ? 'Dialog.Confirm' : 'Dialog.Ok')
    ),
    typeToConfirm: computed(() =>
      this.ngxSignalTranslate.translate('Dialog.TypeToConfirm', { name: this.confirmationText() })
    ),
  };

  protected finish(confirmed: boolean): void {
    if (this.settled || (confirmed && !this.canConfirm())) return;
    this.settled = true;
    const resolve = this.request().resolve;
    this.portal.close(this.element.nativeElement);
    resolve(confirmed);
  }

  public ngOnDestroy(): void {
    if (!this.settled) {
      this.settled = true;
      this.request().resolve(false);
    }
  }
}
