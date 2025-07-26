import { Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';

@Component({
  selector: 'ct-header',
  imports: [RouterLink, RouterLinkActive, NgxSignalTranslatePipe],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private readonly document = inject(DOCUMENT);

  protected onRemoveFocus(): void {
    (this.document.activeElement as HTMLElement)?.blur();
  }
}
