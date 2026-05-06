import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_VERSION, BUILD, BUILD_DATE } from '../main/main-const';
import { mainStateToken } from '../main/main-store';
import { LinkButton } from '@components/link-button/link-button';
import { toastStateToken } from '@components/toast/toast-store';
import { ThemeService } from '@services/theme/theme-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_SETTINGS_LOCK } from '@shared/constants/storage-const';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { BehaviorSubject, debounceTime, filter, tap } from 'rxjs';

@Component({
  selector: 'ct-about',
  imports: [NgxSignalTranslatePipe, LinkButton],
  templateUrl: './about.html',
  styleUrl: './about.css',
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly mainState = inject(mainStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly theme = inject(ThemeService);
  private readonly counter = new BehaviorSubject(0);
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly build = BUILD;
  protected readonly buildDate = BUILD_DATE;
  protected readonly appVersion = APP_VERSION;

  constructor() {
    if (this.mainState.state.settingsLock()) {
      const subscribe = this.counter
        .pipe(
          filter((value) => !!value),
          tap((value) => {
            if (value >= 10) {
              this.mainState.setState('settingsLock', false);
              this.webstorage.setItem(STORAGE_SETTINGS_LOCK, 'false');
              this.counter.next(0);
              subscribe.unsubscribe();
              this.toastState.setState('message', this.ngxSignalTranslate.translate('Toast.SettingsLockDisabled'));
            } else {
              this.toastState.setState(
                'message',
                this.ngxSignalTranslate.translate('Toast.SettingsLockDisable', { count: `${10 - value}` })
              );
            }
          }),
          debounceTime(1000),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => this.counter.next(0));
    }
  }

  protected onClickAppVersion(): void {
    if (this.mainState.state.settingsLock()) this.counter.next(this.counter.value + 1);
  }
}
