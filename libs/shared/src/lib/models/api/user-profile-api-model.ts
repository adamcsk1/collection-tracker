export interface UserProfileApiResponseModel {
  userShareCode: string;
  username: string | null;
  displayName: string | null;
  avatarRevision: string | null;
}

export interface UserProfileApiRequestModel {
  displayName: string | null;
}

export interface UserAvatarApiRequestModel {
  imageBase64: string;
}
