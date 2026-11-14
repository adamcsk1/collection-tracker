import { inject, Injectable } from '@angular/core';
import { MessageDialogOptions } from './message-dialog-model';
import { MessageDialogService } from './message-dialog-service';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly dialogs = inject(MessageDialogService);

  public show(message: string, options: MessageDialogOptions = {}): void {
    this.dialogs.open({ message, mode: 'alert', options });
  }

  public info(message: string, options: MessageDialogOptions = {}): void {
    this.dialogs.open({ message, mode: 'info', options });
  }
}
