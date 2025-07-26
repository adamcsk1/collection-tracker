export interface CollectionBackgroundImageModel {
  url: string;
  x: number;
  y: number;
  animationDuration: number;
}

export type CollectionBackgroundImagesModel = Array<CollectionBackgroundImageModel>;
