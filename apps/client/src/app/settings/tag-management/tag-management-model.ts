export interface TagManagementItemModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagManagementModel = TagManagementItemModel[];

export interface TagManagementExportModel {
  type: 'collection-tracker-tag-management';
  version: 1;
  tagManagement: TagManagementModel;
}
