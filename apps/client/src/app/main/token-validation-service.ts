import { effect, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { redirectToLogin } from '@shared/utils/redirect-to-login-util';
import { SettingsService } from '../settings/settings-service';
import { TagManagementService } from '../settings/tag-management/tag-management-service';
import { MainService } from './main-service';

@Injectable({ providedIn: 'root' })
export class TokenValidationService {
  private readonly main = inject(MainService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly tagManagement = inject(TagManagementService);
  private readonly injector = inject(Injector);

  public startValidation(): void {
    const tokenValidationEffect = effect(
      () => {
        const tokenValidated = this.main.tokenValid();
        if (tokenValidated) {
          forkJoin([this.settings.preloadUserSettings(), this.tagManagement.preloadUserTagManagement()]).subscribe();
          tokenValidationEffect.destroy();
        } else if (tokenValidated === false) {
          redirectToLogin();
          tokenValidationEffect.destroy();
        }
      },
      { injector: this.injector }
    );

    if (this.main.tokenValid() === false) {
      redirectToLogin();
      tokenValidationEffect.destroy();
    }
  }
}
