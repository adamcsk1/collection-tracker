export interface TagConfigModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagConfigsModel = TagConfigModel[];
