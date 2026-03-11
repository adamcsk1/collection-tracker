export interface TagConfigModel {
  tag: string;
  color: string;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  weight: number;
}

export type TagConfigsModel = Array<TagConfigModel>;
