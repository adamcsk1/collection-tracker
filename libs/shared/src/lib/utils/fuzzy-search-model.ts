export interface FuzzyModel {
  match: string;
  index: number;
  distance: number;
}

export type FuzzySearchResultModel = Array<FuzzyModel> | null;
