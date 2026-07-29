import { ExternalMetadataItemModel } from '../models/external-metadata-model';
import { ExternalItemIdentityModel } from '../models/external-metadata-provider-model';

export const isImdbShapedExternalItemId = (externalItemId: string | undefined | null): boolean =>
  typeof externalItemId === 'string' && /^tt\d+$/i.test(externalItemId.trim());

export const getImdbIdFromExternalMetadata = (selectedContent: ExternalMetadataItemModel): string | undefined => {
  const imdbId = selectedContent.externalIds?.find((externalId) => externalId.source === 'imdb')?.id?.trim();
  if (imdbId) return imdbId;
  const providerItemId = selectedContent.providerItemId?.trim();
  return isImdbShapedExternalItemId(providerItemId) ? providerItemId : undefined;
};

export const mergeImdbExternalId = (
  externalIds: ExternalItemIdentityModel[] | undefined,
  imdbId: string | undefined | null
): ExternalItemIdentityModel[] | undefined => {
  const preserved = (externalIds ?? []).filter((externalId) => externalId.source !== 'imdb');
  const normalizedImdbId = imdbId?.trim();
  if (normalizedImdbId) {
    return [...preserved, { source: 'imdb', id: normalizedImdbId }];
  }
  return preserved.length > 0 ? preserved : undefined;
};
