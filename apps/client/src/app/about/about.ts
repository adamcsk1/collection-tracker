import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LinkButton } from '@components/link-button/link-button';
import { ThemeService } from '@services/theme/theme-service';
import { getBasePath } from '@shared/utils/get-base-path-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { APP_VERSION, BUILD, BUILD_DATE } from '../main/main-const';

@Component({
  selector: 'ct-about',
  imports: [LinkButton],
  templateUrl: './about.html',
  styleUrl: './about.css',
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class About {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly theme = inject(ThemeService);
  protected readonly translations = {
    title: computed(() => this.ngxSignalTranslate.translate('AppTitle')),
    aboutDescription: computed(() => this.ngxSignalTranslate.translate('About.Description')),
    build: computed(() => this.ngxSignalTranslate.translate('Build')),
    buildDate: computed(() => this.ngxSignalTranslate.translate('BuildDate')),
    appVersion: computed(() => this.ngxSignalTranslate.translate('AppVersion')),
    links: computed(() => this.ngxSignalTranslate.translate('Links')),
    navigateToServerHealth: computed(() => this.ngxSignalTranslate.translate('NavigateToServerHealth')),
    viewOnGitHub: computed(() => this.ngxSignalTranslate.translate('ViewOnGitHub')),
    downloadApk: computed(() => this.ngxSignalTranslate.translate('DownloadApk')),
    navigateToApiDocs: computed(() => this.ngxSignalTranslate.translate('NavigateToApiDocs')),
  };
  protected readonly themeLogo = this.theme.themeLogo;
  protected readonly build = BUILD;
  protected readonly buildDate = BUILD_DATE;
  protected readonly appVersion = APP_VERSION;
  protected readonly basePath = getBasePath();
}
