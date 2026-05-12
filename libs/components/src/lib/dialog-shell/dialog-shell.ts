import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
  computed,
} from '@angular/core';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Component({
  selector: 'libc-dialog-shell',
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShell implements AfterViewInit {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly dialogRoot = viewChild<ElementRef<HTMLDivElement>>('dialogRoot');

  protected readonly translations = {
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
  };
  public ngAfterViewInit(): void {
    this.dialogRoot()?.nativeElement.focus();
  }

  protected onClose(): void {
    this.portal.close();
  }
}
