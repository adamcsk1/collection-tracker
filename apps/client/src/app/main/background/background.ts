import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, NgZone, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollectionModel } from '@client/collection/collection-model';
import { DESKTOP_HEIGHT_BUFFER, HEIGHT_BUFFER, WIDTH_BUFFER } from '@client/main/background/background-const';
import { BackgroundImagesModel } from '@client/main/background/background-model';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { getCoarsePointerBasedDebounceTime } from '@shared/utils/prefer-coarse-pointer-util';
import { randomInt } from '@shared/utils/random-int-util';
import { debounceTime, filter, fromEvent, map } from 'rxjs';

@Component({
  selector: 'ct-background',
  templateUrl: './background.html',
  styleUrl: './background.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--window-height]': 'windowHeight + "px"',
    '[style.--image-width]': 'imageWidth + "px"',
    '[style.--image-height]': 'imageHeight + "px"',
    'aria-hidden': 'true',
  },
})
export class Background {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private get isTextInputFocused(): boolean {
    return ['INPUT', 'TEXTAREA'].includes(this.document.activeElement?.tagName || '');
  }
  private get viewportHeight(): number {
    return window.visualViewport?.height ?? window.innerHeight;
  }

  private get viewportWidth(): number {
    return window.visualViewport?.width ?? window.innerWidth;
  }
  protected readonly images = signal<BackgroundImagesModel>([]);
  protected readonly imageWidth = 90; // px
  protected readonly imageHeight = 125; // px
  protected windowHeight = this.viewportHeight;
  protected windowWidth = this.viewportWidth;
  private lastViewportHeight = this.windowHeight;
  private lastViewportWidth = this.windowWidth;

  constructor() {
    const effectRef = effect(() => {
      this.setImages(this.mainCollectionState.state.collection(), this.windowHeight, this.windowWidth);
      if (this.mainCollectionState.state.collection().length > 0) effectRef.destroy();
    });

    this.ngZone.runOutsideAngular(() =>
      (mobileUserAgent() ? fromEvent(screen.orientation, 'change') : fromEvent(window, 'resize'))
        .pipe(
          debounceTime(getCoarsePointerBasedDebounceTime()),
          map(() => ({ height: this.viewportHeight, width: this.viewportWidth })),
          filter(({ height, width }) => this.shouldHandleHeight(height) || this.shouldHandleWidth(width)),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(({ height, width }) =>
          this.ngZone.run(() => {
            this.windowHeight = height;
            this.windowWidth = width;
            this.lastViewportHeight = height;
            this.lastViewportWidth = width;

            if (this.isKeyboardLikely(height) || this.isTextInputFocused) return;

            this.setImages(this.mainCollectionState.state.collection(), height, width);
          })
        )
    );
  }

  private setImages(collection: CollectionModel, viewportHeight: number, viewportWidth: number): void {
    if (!collection.length) this.images.set([]);
    else {
      const images: BackgroundImagesModel = [];
      const startY = -Math.ceil(viewportHeight / 2);
      const targetY = Math.ceil(viewportHeight * 1.5);
      let x = 0;
      let y = startY;
      let animationDuration = randomInt(100, 150);

      while (true) {
        const randomIndex = randomInt(0, collection.length - 1);
        images.push({ url: collection[randomIndex].image, x, y, animationDuration });

        if (y > targetY) {
          x += this.imageWidth;
          y = startY;
          animationDuration = randomInt(100, 150);
        } else y += this.imageHeight - 1;

        if (x > viewportWidth) break;
      }
      this.images.set(images);
    }
  }

  private shouldHandleHeight(nextHeight: number): boolean {
    const delta = Math.abs(nextHeight - this.lastViewportHeight);
    return delta > DESKTOP_HEIGHT_BUFFER || this.isKeyboardLikely(nextHeight);
  }

  private shouldHandleWidth(nextWidth: number): boolean {
    const delta = Math.abs(nextWidth - this.lastViewportWidth);
    return delta > WIDTH_BUFFER;
  }

  private isKeyboardLikely(nextHeight: number): boolean {
    const visualHeight = window.visualViewport?.height;
    return Boolean(visualHeight && visualHeight + HEIGHT_BUFFER < window.innerHeight && visualHeight <= nextHeight);
  }
}
