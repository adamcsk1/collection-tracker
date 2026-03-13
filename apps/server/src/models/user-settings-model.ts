import { UserSettingsApiResponseModel } from '@shared/models/api-model';

export type UserSettingsModel = UserSettingsApiResponseModel;

export type UserSettingsMapModel = Record<string, UserSettingsModel>;
