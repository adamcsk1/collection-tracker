import { Component, inject } from '@angular/core';
import { PortalService } from '@lib/services/portal-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-dialog-shell',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
})
export class DialogShell {
  private readonly portal = inject(PortalService);

  protected onClose(): void {
    this.portal.close();
  }
}
