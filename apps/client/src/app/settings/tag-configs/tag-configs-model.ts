export interface TagConfigModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagConfigsModel = TagConfigModel[];

export interface TagConfigsExportModel {
  type: 'collection-tracker-tag-configs';
  version: 1;
  tagConfigs: TagConfigsModel;
}
