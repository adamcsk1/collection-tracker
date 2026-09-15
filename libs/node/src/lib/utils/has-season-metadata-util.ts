import { ExternalMetadataSeasonProvider } from '../models/external-metadata-runtime-model';

export const hasSeasonMetadata = (provider: unknown): provider is ExternalMetadataSeasonProvider => {
  return typeof (provider as Partial<ExternalMetadataSeasonProvider>).getSeriesSeasons === 'function';
};
