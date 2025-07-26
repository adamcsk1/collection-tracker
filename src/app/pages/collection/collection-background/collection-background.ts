import { Component, computed, inject } from '@angular/core';
import { opacityAnimation } from '@animations/opacity-animation';
import { collectionStateToken } from '@stores/collection-store';
import { randomInt } from '@utils/random-int.util';
import { CollectionBackgroundImagesModel } from './collection-background.model';

@Component({
  selector: 'ct-collection-background',
  templateUrl: './collection-background.html',
  styleUrl: './collection-background.css',
  animations: [opacityAnimation],
})
export class CollectionBackground {
  private readonly collectionState = inject(collectionStateToken);
  protected readonly images = computed<CollectionBackgroundImagesModel>(() => {
    const collection = this.collectionState.state.collection();

    if (!collection.length) return [];

    const images: CollectionBackgroundImagesModel = [];

    // ?? Temporary
    let x = 0; // 90
    let y = 0; // 125
    let animationDuration = randomInt(70, 100);
    let imageColumn: CollectionBackgroundImagesModel = [];
    while (true) {
      const randomIndex = randomInt(0, collection.length - 1);

      imageColumn.push({ url: collection[randomIndex].image, x, y, animationDuration });
      if (y > window.innerHeight) {
        x += 90;
        y = 0;
        const imageColumnLength = imageColumn.length;
        for (let i = 0; i < imageColumnLength; i++) {
          imageColumn.push({ ...imageColumn[i], y: imageColumn[i].y - window.innerHeight });
        }
        animationDuration = randomInt(70, 100);
        images.push(...imageColumn);
        imageColumn = [];
      } else y += 125;
      if (x > window.innerWidth) {
        const imageColumnLength = imageColumn.length;
        for (let i = 0; i < imageColumnLength; i++) {
          imageColumn.push({ ...imageColumn[i], y: imageColumn[i].y - window.innerHeight });
        }
        images.push(...imageColumn);
        imageColumn = [];
        break;
      }
    }

    return images;
  });
}
