import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { MenuDialog } from '../menu-dialog/menu-dialog';

@Component({
  selector: 'ct-header',
  imports: [NgxSignalTranslatePipe, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'banner',
  },
})
export class Header {
  private readonly portal = inject(PortalService);

  protected onOpenMenu(): void {
    this.portal.open(MenuDialog);
  }
}
