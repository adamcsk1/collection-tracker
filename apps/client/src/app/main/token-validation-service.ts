import { effect, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionService } from '../collection/collection-service';
import { MainService } from './main-service';
import { redirectToLogin } from './main-util';
import { SettingsService } from '../settings/settings-service';
import { TagConfigsService } from '../tag-configs/tag-configs-service';
import { ParserService } from '@services/parser/parser-service';
import { forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TokenValidationService {
  private readonly main = inject(MainService);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionService);
  private readonly parser = inject(ParserService);
  private readonly settings = inject(SettingsService);
  private readonly tagConfigs = inject(TagConfigsService);
  private readonly injector = inject(Injector);

  public startValidation(): void {
    const tokenValidationEffect = effect(
      () => {
        const tokenValidated = this.main.tokenValid();
        if (tokenValidated) {
          forkJoin([
            this.settings.preloadUserSettings(),
            this.parser.preloadUserParserConfig(),
            this.tagConfigs.preloadUserTagConfigs(),
          ]).subscribe(() => this.collection.loadCollection());
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
