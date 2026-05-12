import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { mainStateToken } from '../main/main-store';

@Component({
  selector: 'ct-settings',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainState = inject(mainStateToken);
  protected readonly translations = {
    settings: computed(() => this.ngxSignalTranslate.translate('Settings')),
    basics: computed(() => this.ngxSignalTranslate.translate('Basics')),
    user: computed(() => this.ngxSignalTranslate.translate('User')),
    accessTokens: computed(() => this.ngxSignalTranslate.translate('AccessTokens')),
    tagConfig: computed(() => this.ngxSignalTranslate.translate('TagConfig')),
    images: computed(() => this.ngxSignalTranslate.translate('Images')),
    globalWatchStatus: computed(() => this.ngxSignalTranslate.translate('GlobalWatchStatus')),
  };
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
}
