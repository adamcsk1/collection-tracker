import type { CollectionItemContentTypeModel, CollectionListTypeModel } from '../collection-item-model';

export interface UserShareGrantApiModel {
  listType: CollectionListTypeModel;
  contentType: CollectionItemContentTypeModel;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface UserShareOutgoingApiModel {
  sharedWithUserShareCode: string;
  sharedWithUsername: string | null;
  grants: UserShareGrantApiModel[];
}

export interface UserShareIncomingApiModel {
  ownerUserShareCode: string;
  ownerUsername: string | null;
  grants: UserShareGrantApiModel[];
}

export interface UserSharesApiResponseModel {
  userShareCode: string;
  outgoing: UserShareOutgoingApiModel[];
  incoming: UserShareIncomingApiModel[];
}
