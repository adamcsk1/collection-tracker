import { effect, inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionService } from '@client/collection/collection-service';
import { MainService } from '@client/main/main-service';
import { redirectToLogin } from '@client/main/main-util';
import { TagConfigsService } from '@client/tag-configs/tag-configs-service';
import { omdbStateToken } from '@services/omdb/omdb-store';
import { ParserService } from '@services/parser/parser-service';
import { forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TokenValidationService {
  private readonly main = inject(MainService);
  private readonly omdbState = inject(omdbStateToken);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionService);
  private readonly parser = inject(ParserService);
  private readonly tagConfigs = inject(TagConfigsService);
  private readonly injector = inject(Injector);

  public startValidation(): void {
    const tokenValidationEffect = effect(
      () => {
        const tokenValidated = this.main.tokenValid();
        if (tokenValidated) {
          if (!this.omdbState.state.apiKey()) this.router.navigate(['settings']);
          forkJoin([this.parser.preloadUserParserConfig(), this.tagConfigs.preloadUserTagConfigs()]).subscribe(() =>
            this.collection.loadCollection()
          );
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
