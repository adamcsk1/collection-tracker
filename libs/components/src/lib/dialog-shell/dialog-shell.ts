import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
  computed,
  signal,
} from '@angular/core';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

let nextDialogShellActionsMenuId = 0;

@Component({
  selector: 'libc-dialog-shell',
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShell implements AfterViewInit, OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly portal = inject(PortalService);
  private readonly dialogRoot = viewChild<ElementRef<HTMLDivElement>>('dialogRoot');
  private readonly menuContent = viewChild<ElementRef<HTMLDivElement>>('menuContent');
  private menuContentObserver?: MutationObserver;
  public readonly closeWithPortal = input(true);
  public readonly closed = output<void>();
  protected readonly hasMenuContent = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly actionsMenuId = `dialog-shell-actions-menu-${nextDialogShellActionsMenuId++}`;

  protected readonly translations = {
    close: computed(() => this.ngxSignalTranslate.translate('Close')),
    moreActions: computed(() => this.ngxSignalTranslate.translate('MoreActions')),
  };
  public ngAfterViewInit(): void {
    this.dialogRoot()?.nativeElement.focus();
    this.updateHasMenuContent();
    const menuContentElement = this.menuContent()?.nativeElement;
    if (menuContentElement) {
      this.menuContentObserver = new MutationObserver(() => this.updateHasMenuContent());
      this.menuContentObserver.observe(menuContentElement, { childList: true });
    }
  }

  public ngOnDestroy(): void {
    this.menuContentObserver?.disconnect();
  }

  protected onToggleMenu(): void {
    this.menuOpen.update((isOpen) => !isOpen);
  }

  protected onClose(): void {
    this.menuOpen.set(false);
    this.closed.emit();
    if (this.closeWithPortal()) this.portal.close();
  }

  private updateHasMenuContent(): void {
    const hasActions = Boolean(this.menuContent()?.nativeElement.childElementCount);
    this.hasMenuContent.set(hasActions);
    if (!hasActions) this.menuOpen.set(false);
  }
}
