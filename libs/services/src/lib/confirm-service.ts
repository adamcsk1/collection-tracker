import { inject, Injectable } from '@angular/core';
import { filter, Observable } from 'rxjs';
import { ConfirmDialogOptions } from './message-dialog-model';
import { MessageDialogService } from './message-dialog-service';

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private readonly dialogs = inject(MessageDialogService);

  public open(message: string, options: ConfirmDialogOptions = {}): Observable<boolean> {
    return this.dialogs.open({ message, mode: 'confirm', options });
  }

  public ifConfirmed(message: string, options: ConfirmDialogOptions = {}): Observable<boolean> {
    return this.open(message, options).pipe(filter((confirmed) => confirmed));
  }
}
