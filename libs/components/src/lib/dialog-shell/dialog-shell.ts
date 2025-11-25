import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'libc-dialog-shell',
  imports: [NgxSignalTranslatePipe],
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShell implements AfterViewInit {
  private readonly portal = inject(PortalService);
  private readonly dialogRoot = viewChild<ElementRef<HTMLDivElement>>('dialogRoot');

  public ngAfterViewInit(): void {
    this.dialogRoot()?.nativeElement.focus();
  }

  protected onClose(): void {
    this.portal.close();
  }
}
