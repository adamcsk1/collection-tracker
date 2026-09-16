export interface MusicBrainzNamedModel {
  name?: string;
}

export interface MusicBrainzArtistCreditModel {
  name?: string;
  artist?: MusicBrainzNamedModel;
}

export interface MusicBrainzReleaseGroupModel {
  id?: string;
  tags?: MusicBrainzNamedModel[];
}

export interface MusicBrainzReleaseModel {
  id?: string;
  title?: string;
  date?: string;
  'artist-credit'?: MusicBrainzArtistCreditModel[];
  tags?: MusicBrainzNamedModel[];
  'release-group'?: MusicBrainzReleaseGroupModel;
}

export interface MusicBrainzSearchResponseModel {
  releases?: MusicBrainzReleaseModel[];
}
