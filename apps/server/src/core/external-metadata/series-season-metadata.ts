import { TrackingSeasonMetadataModel } from '@shared/models/api-model';
import { ExternalMetadataProvider, ExternalMetadataSeasonProvider } from './external-metadata-provider';
import { getExternalMetadataProviderByName } from './external-metadata-provider-factory';

const hasSeasonMetadata = (provider: ExternalMetadataProvider): provider is ExternalMetadataSeasonProvider => {
  return 'getSeriesSeasons' in provider;
};

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
