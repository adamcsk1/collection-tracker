import { hasSeasonMetadata } from '@node/utils/has-season-metadata-util';
import { TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { getExternalMetadataProviderByName } from './external-metadata-provider-factory';

export const fetchSeriesSeasonMetadata = async (
  externalProvider: string,
  externalItemId: string
): Promise<TrackingSeasonMetadataModel[]> => {
  const provider = getExternalMetadataProviderByName(externalProvider);
  return provider && hasSeasonMetadata(provider) ? provider.getSeriesSeasons(externalItemId) : [];
};

export const tryFetchSeriesSeasonMetadata = async (
  externalProvider: string,
  externalItemId: string
): Promise<TrackingSeasonMetadataModel[]> => {
  try {
    return await fetchSeriesSeasonMetadata(externalProvider, externalItemId);
  } catch {
    return [];
  }
};
