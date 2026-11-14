import { inject, Injectable, Injector } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { MESSAGE_DIALOG_COMPONENT } from './message-dialog-const';
import { MessageDialogRequest } from './message-dialog-model';
import { PortalService } from './portal-service';

@Injectable({ providedIn: 'root' })
export class MessageDialogService {
  private readonly injector = inject(Injector);
  private readonly portal = inject(PortalService);

  public open(request: Omit<MessageDialogRequest, 'resolve'>): Observable<boolean> {
    const result = new ReplaySubject<boolean>(1);
    this.portal.openStacked(this.injector.get(MESSAGE_DIALOG_COMPONENT), {
      request: {
        ...request,
        resolve: (confirmed: boolean) => {
          if (result.closed || result.isStopped) return;
          result.next(confirmed);
          result.complete();
        },
      } satisfies MessageDialogRequest,
    });
    return result.asObservable();
  }
}
