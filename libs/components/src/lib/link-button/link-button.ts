import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'libc-link-button',
  templateUrl: './link-button.html',
  styleUrl: './link-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkButton {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    opensInNewTab: computed(() => this.ngxSignalTranslate.translate('Aria.OpensInNewTab')),
  };
  public readonly href = input.required<string>();
  public readonly icon = input.required<string>();
  public readonly label = input.required<string>();
  public readonly external = input(false);
  public readonly dataTestId = input<string>('');
}
