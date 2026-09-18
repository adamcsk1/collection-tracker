import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
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
import { shuffle } from '@shared/utils/shuffle-util';
import { catchError, debounceTime, filter, fromEvent, map, merge, of } from 'rxjs';
import {
  DESKTOP_HEIGHT_BUFFER,
  HEIGHT_BUFFER,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  WIDTH_BUFFER,
} from './poster-background-const';
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
  protected readonly imageWidth = IMAGE_WIDTH;
  protected readonly imageHeight = IMAGE_HEIGHT;
  private readonly canLoad = signal(false);
  protected readonly windowHeight = signal(this.viewportHeight);
  protected readonly windowWidth = signal(this.viewportWidth);
  private lastViewportHeight = this.viewportHeight;
  private lastViewportWidth = this.viewportWidth;
  private imageUrls: string[] = [];

  constructor() {
    afterNextRender(() => this.canLoad.set(true));

    effect(() => {
      this.refreshTrigger();
      if (!this.canLoad()) return;
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
        this.imageUrls = shuffle([...new Set(response.images.filter(Boolean))]);
        this.setImages(this.windowHeight(), this.windowWidth());
      });
  }

  private setImages(viewportHeight: number, viewportWidth: number): void {
    if (!this.imageUrls.length) {
      this.images.set([]);
      return;
    }

    const images: PosterBackgroundImagesModel = [];
    const reducedMotion = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const startY = reducedMotion ? 0 : -Math.ceil(viewportHeight / 2);
    const targetY = reducedMotion ? viewportHeight : Math.ceil(viewportHeight * 1.5);
    const urls = this.imageUrls;
    const apiUrl = this.apiState.state.apiUrl();
    let x = 0;
    let y = startY;
    let row = 0;
    let sequenceIndex = 0;
    let previousColumn: string[] = [];
    let currentColumn: string[] = [];
    let animationDuration = randomInt(100, 150);

    const nextUrl = (left: string | undefined, above: string | undefined): string => {
      const startIndex = sequenceIndex;
      do {
        const sourceUrl = urls[sequenceIndex % urls.length];
        sequenceIndex += 1;
        if (urls.length === 1 || (sourceUrl !== left && sourceUrl !== above)) return sourceUrl;
      } while (sequenceIndex - startIndex < urls.length);
      return urls[(sequenceIndex - 1) % urls.length];
    };

    while (true) {
      const sourceUrl = nextUrl(previousColumn[row], currentColumn.at(-1));
      currentColumn.push(sourceUrl);
      images.push({
        url: getProxyImageUrl(apiUrl, sourceUrl, 'background'),
        x,
        y,
        animationDuration,
      });

      if (y > targetY) {
        previousColumn = currentColumn;
        currentColumn = [];
        row = 0;
        x += this.imageWidth;
        y = startY;
        animationDuration = randomInt(100, 150);
      } else {
        row += 1;
        y += this.imageHeight - 1;
      }

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
