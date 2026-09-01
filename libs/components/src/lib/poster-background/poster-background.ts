import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PublicApiService } from '@services/api/public-api-service';
import { apiStateToken } from '@services/api/api-store';
import { mobileUserAgent } from '@shared/utils/mobile-user-agent.util';
import { getCoarsePointerBasedDebounceTime } from '@shared/utils/prefer-coarse-pointer-util';
import { getProxyImageUrl } from '@shared/utils/proxy-image-url-util';
import { randomInt } from '@shared/utils/random-int-util';
import { catchError, debounceTime, filter, fromEvent, map, merge, of } from 'rxjs';
import { DESKTOP_HEIGHT_BUFFER, HEIGHT_BUFFER, WIDTH_BUFFER } from './poster-background-const';
import { PosterBackgroundImagesModel } from './poster-background-model';

@Component({
  selector: 'libc-poster-background',
  templateUrl: './poster-background.html',
  styleUrl: './poster-background.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--window-height]': 'windowHeight() + "px"',
    '[style.--image-width]': 'imageWidth + "px"',
    '[style.--image-height]': 'imageHeight + "px"',
    'aria-hidden': 'true',
  },
})
export class PosterBackground {
  private readonly api = inject(PublicApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
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
  public readonly refreshTrigger = input(0);
  protected readonly images = signal<PosterBackgroundImagesModel>([]);
  protected readonly imageWidth = 90;
  protected readonly imageHeight = 125;
  protected readonly windowHeight = signal(this.viewportHeight);
  protected readonly windowWidth = signal(this.viewportWidth);
  private lastViewportHeight = this.viewportHeight;
  private lastViewportWidth = this.viewportWidth;
  private imageUrls: string[] = [];

  constructor() {
    effect(() => {
      this.refreshTrigger();
      untracked(() => this.loadImages());
    });

    const resizeEvent$ = mobileUserAgent()
      ? merge(fromEvent(screen.orientation, 'change'), fromEvent(window, 'resize'))
      : fromEvent(window, 'resize');

    resizeEvent$
      .pipe(
        debounceTime(getCoarsePointerBasedDebounceTime()),
        map(() => ({ height: this.viewportHeight, width: this.viewportWidth })),
        filter(({ height, width }) => this.shouldHandleHeight(height) || this.shouldHandleWidth(width)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ height, width }) => {
        this.windowHeight.set(height);
        this.windowWidth.set(width);
        this.lastViewportHeight = height;
        this.lastViewportWidth = width;

        if (this.isKeyboardLikely(height) || this.isTextInputFocused) return;

        this.setImages(height, width);
      });
  }

  private loadImages(): void {
    this.api
      .getBackgroundImages()
      .pipe(
        catchError(() => of({ images: [] })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.imageUrls = response.images;
        this.setImages(this.windowHeight(), this.windowWidth());
      });
  }

  private setImages(viewportHeight: number, viewportWidth: number): void {
    if (!this.imageUrls.length) {
      this.images.set([]);
      return;
    }

    const images: PosterBackgroundImagesModel = [];
    const startY = -Math.ceil(viewportHeight / 2);
    const targetY = Math.ceil(viewportHeight * 1.5);
    let x = 0;
    let y = startY;
    let animationDuration = randomInt(100, 150);

    while (true) {
      const randomIndex = randomInt(0, this.imageUrls.length - 1);
      images.push({
        url: getProxyImageUrl(this.apiState.state.apiUrl(), this.imageUrls[randomIndex]),
        x,
        y,
        animationDuration,
      });

      if (y > targetY) {
        x += this.imageWidth;
        y = startY;
        animationDuration = randomInt(100, 150);
      } else y += this.imageHeight - 1;

      if (x > viewportWidth) break;
    }
    this.images.set(images);
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
