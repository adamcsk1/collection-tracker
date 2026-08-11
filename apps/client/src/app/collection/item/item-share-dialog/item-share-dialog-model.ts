import { CollectionItemShareApiModel } from '@shared/models/api-model';

export interface ItemShareDraft extends CollectionItemShareApiModel {
  permissionSetupRequired: boolean;
  selected: boolean;
}
