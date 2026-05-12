import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
  computed,
} from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { ImageIcon } from '@components/image-icon/image-icon';
import { Textarea } from '@components/textarea/textarea';
import { AlertService } from '@services/alert-service';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-ai-search-input',
  imports: [Textarea, FormField, ImageIcon],
  templateUrl: './ai-search-input.html',
  styleUrl: './ai-search-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSearchInput {
  private readonly injector = inject(Injector);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly alert = inject(AlertService);
  private readonly expandedPanel = viewChild<ElementRef<HTMLDivElement>>('expandedPanel');
  protected readonly translations = {
    sendPrompt: computed(() => this.ngxSignalTranslate.translate('SendPrompt')),
    messageAiSearch: computed(() => this.ngxSignalTranslate.translate('Message.AiSearch')),
    aiSearch: computed(() => this.ngxSignalTranslate.translate('AiSearch')),
    aiSearchInfo: computed(() => this.ngxSignalTranslate.translate('AiSearchInfo')),
  };
  protected readonly isExpanded = signal(false);
  protected readonly ollamaIcon = `${getBasePath()}/client/images/ollama-icon.png`;
  public readonly formField = input.required<FieldTree<string>>();
  public readonly placeholder = input<string>('');
  public readonly sendEvent = output<void>();

  protected currentValue(): string {
    return this.formField()().value() ?? '';
  }

  protected onExpand(): void {
    if (this.isExpanded()) return;
    this.isExpanded.set(true);
    afterNextRender(() => this.expandedPanel()?.nativeElement.querySelector('textarea')?.focus(), {
      injector: this.injector,
    });
  }

  protected onCollapse(): void {
    this.isExpanded.set(false);
  }

  protected onPanelFocusOut(event: FocusEvent): void {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!this.expandedPanel()?.nativeElement.contains(relatedTarget)) {
      this.isExpanded.set(false);
    }
  }

  protected onSend(): void {
    this.sendEvent.emit();
    this.isExpanded.set(false);
  }

  protected onShowMessage(): void {
    this.alert.show(this.ngxSignalTranslate.translate('Message.AiSearch'));
  }
}
