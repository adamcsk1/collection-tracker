import { inject, Injectable } from '@angular/core';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { redirectToLogin } from '../../../../../libs/shared/src/lib/utils/redirect-to-login-util';
import { mainStateToken } from './main-store';

@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly mainState = inject(mainStateToken);
  private readonly webstorage = inject(WebstorageService);

  public performLogout(): void {
    if (this.mainState.state.clearLocalStorageAfterLogout()) this.webstorage.clear();
    redirectToLogin();
  }
}
