import { ExternalMetadataSeasonProvider } from './external-metadata-provider';

export const hasSeasonMetadata = (provider: unknown): provider is ExternalMetadataSeasonProvider => {
  return typeof (provider as Partial<ExternalMetadataSeasonProvider>).getSeriesSeasons === 'function';
};
