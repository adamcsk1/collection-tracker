export interface StatisticsItemModel {
  tag: string;
  count: number;
}

export type StatisticsModel = Array<StatisticsItemModel>;

export interface StatisticsGroupModel {
  movies: StatisticsModel;
  series: StatisticsModel;
  global: StatisticsModel;
}
