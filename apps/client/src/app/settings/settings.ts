import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { mainStateToken } from '../main/main-store';

@Component({
  selector: 'ct-settings',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly mainState = inject(mainStateToken);
  protected readonly settingLockEnabled = this.mainState.state.settingsLock;
}
