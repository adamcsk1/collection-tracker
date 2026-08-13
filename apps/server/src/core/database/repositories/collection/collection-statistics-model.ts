export interface BaseSummaryRow {
  total: number;
  favorites: number;
}

export interface AllSummaryRow extends BaseSummaryRow {
  movies: number;
  series: number;
  books: number;
}

export interface SpecificSummaryRow extends BaseSummaryRow {
  tracked: number;
  completed: number;
  in_progress: number;
}
