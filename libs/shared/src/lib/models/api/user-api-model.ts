import type { CollectionFeaturePreferencesModel } from '../collection-feature-preferences-model';
import type { CollectionListDisplayPreferencesModel } from '../collection-list-display-preferences-model';
import type { LanguageModel } from '../language-model';
import type { ThemeModel } from '../theme-model';
import type { CollectionOwnerDefaultModel } from '../collection-owner-default-model';

export interface UserSettingsApiResponseModel {
  theme?: ThemeModel;
  animatedBackground?: boolean;
  language?: LanguageModel;
  defaultCollectionOwners?: CollectionOwnerDefaultModel[];
  collectionListDisplayPreferences?: CollectionListDisplayPreferencesModel;
  collectionFeaturePreferences?: CollectionFeaturePreferencesModel;
}

export interface AiAvailableApiResponseModel {
  aiAvailable: boolean;
}

export interface UserSettingsApiRequestModel extends UserSettingsApiResponseModel {
  fromLogin?: boolean; // To initialize language and theme after first login, as the client won't have the user settings yet.
}

export interface TagManagementApiModel {
  tag: string;
  color: string | null;
  useForImageBorder: boolean;
  useForTextColor: boolean;
  useForImageBadge: boolean;
  weight: number;
}

export type TagManagementApiResponseModel = TagManagementApiModel[];
export type TagManagementApiRequestModel = TagManagementApiResponseModel;

export interface RenameTagApiRequestModel {
  oldTag: string;
  newTag: string;
}

export interface RenameTagApiResponseModel {
  renamedItemCount: number;
  tagManagement: TagManagementApiResponseModel;
}

export interface HealthApiResponseModel {
  status: 'ok' | 'warn' | 'error';
}

export interface HealthDiagnosticsApiResponseModel extends HealthApiResponseModel {
  memory: {
    usedPercent: number;
  };
  cpu: {
    usagePercent: number;
  };
  disk: {
    usedPercent: number;
  } | null;
  load: {
    avg1m: number;
    avg5m: number;
    avg15m: number;
  };
  frontend: {
    status: 'up' | 'down';
  };
  metadata: {
    status: 'up' | 'down';
  };
  ai: {
    status: 'up' | 'down';
  };
}
