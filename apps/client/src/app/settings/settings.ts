import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
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

  protected readonly navExpanded = signal(false);

  protected readonly translations = {
    settings: computed(() => this.ngxSignalTranslate.translate('Settings')),
    toggleMenu: computed(() => this.ngxSignalTranslate.translate('Settings.ToggleMenu')),
    basics: computed(() => this.ngxSignalTranslate.translate('Basics')),
    user: computed(() => this.ngxSignalTranslate.translate('User')),
    accessTokens: computed(() => this.ngxSignalTranslate.translate('AccessTokens')),
    tagManagement: computed(() => this.ngxSignalTranslate.translate('TagManagement')),
    collectionListDisplay: computed(() => this.ngxSignalTranslate.translate('CollectionListDisplay')),
    features: computed(() => this.ngxSignalTranslate.translate('Features')),
    mediaRefresh: computed(() => this.ngxSignalTranslate.translate('MediaRefresh')),
    manageTrackerData: computed(() => this.ngxSignalTranslate.translate('ManageTrackerData')),
    shares: computed(() => this.ngxSignalTranslate.translate('Shares')),
    exportImport: computed(() => this.ngxSignalTranslate.translate('ExportImport')),
  };

  protected onToggleNav(): void {
    this.navExpanded.update((expanded) => !expanded);
  }

  protected onNavLinkClick(): void {
    this.navExpanded.set(false);
  }
}
