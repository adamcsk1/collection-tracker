export interface BackgroundImageModel {
  url: string;
  x: number;
  y: number;
  animationDuration: number;
}

export type BackgroundImagesModel = Array<BackgroundImageModel>;
