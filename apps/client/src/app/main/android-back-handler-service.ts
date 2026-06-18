import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';

type AndroidBackWindow = Window & { CollectionTrackerAndroidBack?: () => boolean };

@Injectable({
  providedIn: 'root',
})
export class AndroidBackHandlerService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private listening = false;

  public listen(): void {
    if (this.listening) return;

    const window = this.document.defaultView as AndroidBackWindow | null;
    if (!window) return;

    this.listening = true;
    window.CollectionTrackerAndroidBack = (): boolean => {
      const topDialog = Array.from(this.document.querySelectorAll<HTMLElement>('.dialog-frame'))
        .filter((dialog) => !dialog.closest('[inert]'))
        .at(-1);
      if (!topDialog) return false;

      topDialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return true;
    };

    this.destroyRef.onDestroy(() => {
      if (window.CollectionTrackerAndroidBack) {
        delete window.CollectionTrackerAndroidBack;
      }
    });
  }
}
