import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DialogShell } from '@components/dialog-shell/dialog-shell';
import { MenuNav } from '../menu-nav/menu-nav';

@Component({
  selector: 'ct-menu-dialog',
  imports: [DialogShell, MenuNav],
  templateUrl: './menu-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dialog',
  },
})
export class MenuDialog {}
