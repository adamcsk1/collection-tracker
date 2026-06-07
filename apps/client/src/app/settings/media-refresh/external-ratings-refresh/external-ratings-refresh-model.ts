export interface ExternalRatingsRefreshStateModel {
  running: boolean;
  completed: boolean;
  count: number;
  checked: number;
  fixed: number;
  errors: number;
}
