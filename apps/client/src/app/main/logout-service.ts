import { inject, Injectable } from '@angular/core';
import { mainStateToken } from './main-store';
import { redirectToLogin } from './main-util';
import { WebstorageService } from '@services/webstorage/webstorage-service';

@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly mainState = inject(mainStateToken);
  private readonly webstorage = inject(WebstorageService);

  public performLogout(): void {
    if (this.mainState.state.clearLocalStorageAfterLogout()) this.webstorage.clear();
    redirectToLogin();
  }
}
