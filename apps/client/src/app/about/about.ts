import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_VERSION, BUILD, BUILD_DATE } from '@client/app-const';
import { appStateToken } from '@client/app-store';
import { SETTINGS_STORAGE_SETTINGS_LOCK } from '@client/settings/settings-const';
import { toastStateToken } from '@components/toast/toast-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { BehaviorSubject, debounceTime, filter, tap } from 'rxjs';

@Component({
  selector: 'ct-about',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly webstorage = inject(WebstorageService);
  private readonly appState = inject(appStateToken);
  private readonly toastState = inject(toastStateToken);
  private readonly counter = new BehaviorSubject(0);
  protected readonly build = BUILD;
  protected readonly buildDate = BUILD_DATE;
  protected readonly appVersion = APP_VERSION;

  constructor() {
    if (this.appState.state.settingsLock()) {
      const subscribe = this.counter
        .pipe(
          filter((value) => !!value),
          tap((value) => {
            if (value >= 10) {
              this.appState.setState('settingsLock', false);
              this.webstorage.setItem(SETTINGS_STORAGE_SETTINGS_LOCK, 'false');
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
    if (this.appState.state.settingsLock()) this.counter.next(this.counter.value + 1);
  }
}
