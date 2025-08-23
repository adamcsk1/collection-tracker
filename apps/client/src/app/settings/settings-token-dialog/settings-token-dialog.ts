import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { toastStateToken } from '@components/toast/toast-store';
import { copyToClipboard } from '@shared/utils/copy-to-clipboard-util';
import { mobileUserAgent } from '@shared/utils/mobile-user-ageint.util';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'ct-settings-token-dialog',
  imports: [NgxSignalTranslatePipe, DialogShell],
  templateUrl: './settings-token-dialog.html',
  styleUrl: './settings-token-dialog.css',
  host: {
    class: 'dialog',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsTokenDialog {
  private readonly toastState = inject(toastStateToken);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  public readonly title = input.required<string>();
  public readonly message = input.required<string>();
  public readonly token = input.required<string>();

  protected onCopyToClipboard(): void {
    copyToClipboard(this.token());
    if (!mobileUserAgent()) {
      this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.CopiedToClipboard'));
    }
  }
}
