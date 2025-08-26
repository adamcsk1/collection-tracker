import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CollectionModel } from '@client/collection/collection-model';
import { CollectionBackgroundImagesModel } from '@client/main/collection-background/collection-background-model';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { opacityAnimation } from '@shared/animations/opacity-animation';
import { randomInt } from '@shared/utils/random-int-util';
import { debounceTime, fromEvent } from 'rxjs';

@Component({
  selector: 'ct-collection-background',
  templateUrl: './collection-background.html',
  styleUrl: './collection-background.css',
  animations: [opacityAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--window-height]': 'windowHeight + "px"',
    '[style.--image-width]': 'imageWidth + "px"',
    '[style.--image-height]': 'imageHeight + "px"',
  },
})
export class CollectionBackground {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly images = signal<CollectionBackgroundImagesModel>([]);
  protected readonly imageWidth = 90; // px
  protected readonly imageHeight = 125; // px
  protected windowHeight = window.innerHeight;

  constructor() {
    effect(() => this.setImages(this.mainCollectionState.state.collection()));

    fromEvent(window, 'resize')
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.windowHeight = window.innerHeight;
        this.setImages(this.mainCollectionState.state.collection());
      });
  }

  private setImages(collection: CollectionModel): void {
    if (!collection.length) this.images.set([]);
    else {
      const images: CollectionBackgroundImagesModel = [];
      const startY = -Math.ceil(window.innerHeight / 2);
      const targetY = Math.ceil(window.innerHeight * 1.5);
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
        } else y += this.imageHeight - 1; // slight overlap to avoid gaps

        if (x > window.innerWidth) break;
      }
      this.images.set(images);
    }
  }
}
