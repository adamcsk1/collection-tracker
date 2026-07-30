import { CollectionListTypeModel } from './api-model';

export interface AiQueryRequestModel {
  prompt: string;
  listType: CollectionListTypeModel;
}

export interface AiQueryResponseModel {
  matchedIds: string[];
}
