import { effect, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { redirectToLogin } from '@shared/utils/redirect-to-login-util';
import { SettingsService } from '../settings/settings-service';
import { TagConfigsService } from '../settings/tag-configs/tag-configs-service';
import { MainService } from './main-service';

@Injectable({ providedIn: 'root' })
export class TokenValidationService {
  private readonly main = inject(MainService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly tagConfigs = inject(TagConfigsService);
  private readonly injector = inject(Injector);

  public startValidation(): void {
    const tokenValidationEffect = effect(
      () => {
        const tokenValidated = this.main.tokenValid();
        if (tokenValidated) {
          forkJoin([this.settings.preloadUserSettings(), this.tagConfigs.preloadUserTagConfigs()]).subscribe();
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
