import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
} from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { Textarea } from '@components/textarea/textarea';
import { AlertService } from '@services/alert-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-ai-search-dialog',
  imports: [DialogShell, Textarea, FormField],
  templateUrl: './ai-search-dialog.html',
  styleUrl: './ai-search-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSearchDialog {
  private readonly injector = inject(Injector);
  private readonly elementRef = inject(ElementRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly alert = inject(AlertService);
  private readonly portal = inject(PortalService);
  protected readonly translations = {
    aiSearch: computed(() => this.ngxSignalTranslate.translate('AiSearch')),
    sendPrompt: computed(() => this.ngxSignalTranslate.translate('SendPrompt')),
    messageAiSearch: computed(() => this.ngxSignalTranslate.translate('Message.AiSearch')),
    aiSearchInfo: computed(() => this.ngxSignalTranslate.translate('AiSearchInfo')),
  };
  public readonly formField = input.required<FieldTree<string>>();
  public readonly placeholder = input<string>('');
  public readonly send = input.required<() => void>();

  constructor() {
    afterNextRender(() => this.elementRef.nativeElement.querySelector('textarea')?.focus(), {
      injector: this.injector,
    });
  }

  protected onSend(): void {
    this.send()();
    this.portal.close();
  }

  protected onShowMessage(): void {
    this.alert.show(this.ngxSignalTranslate.translate('Message.AiSearch'));
  }
}
