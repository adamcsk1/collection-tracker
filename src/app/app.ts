import { Component, effect, inject, OnInit, viewChild, ViewContainerRef } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CollectionService } from '@collection/collection-service';
import { SpinnerLoading } from '@lib/components/spinner-loading/spinner-loading';
import { Toast } from '@lib/components/toast/toast';
import { PortalService } from '@lib/services/portal-service';
import { ThemeService } from '@lib/services/theme/theme-service';
import { SettingsService } from '@settings/settings-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { Header } from './header/header';

@Component({
  selector: 'ct-root',
  imports: [RouterOutlet, Header, SpinnerLoading, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly signalTranslateService = inject(NgxSignalTranslateService);
  private readonly settings = inject(SettingsService);
  private readonly collectionService = inject(CollectionService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly collectionDialogsRef = viewChild('portal', { read: ViewContainerRef });

  constructor() {
    const effectRef = effect(() => {
      if (this.settings.hasSettings()) {
        this.collectionService.loadCollection();
        effectRef.destroy();
      }
    });

    this.signalTranslateService.setLanguage('en');
    this.settings.loadStoredData();
    this.theme.listen();

    if (!this.settings.hasSettings()) this.router.navigate(['/', 'settings']);
  }

  public ngOnInit(): void {
    this.portal.setViewContainerRef(this.collectionDialogsRef()!);
  }
}
