import { SeriesTrackerSeasonMetadataModel } from '@shared/models/api-model';
import { ExternalMetadataProviderNameModel } from '@shared/models/external-metadata-provider-model';
import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';

export interface ExternalMetadataProvider {
  readonly name: ExternalMetadataProviderNameModel;
  readonly supportsDirectImdbId?: boolean;
  search(searchText: string): Promise<ExternalMetadataSearchResponseModel>;
  getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null>;
  getItemByImdbId?(imdbId: string): Promise<ExternalMetadataItemModel | null>;
}

export interface ExternalMetadataSeasonProvider extends ExternalMetadataProvider {
  getSeriesSeasons(providerItemId: string): Promise<SeriesTrackerSeasonMetadataModel[]>;
}
