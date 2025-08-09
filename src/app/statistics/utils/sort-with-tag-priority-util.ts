import { StatisticsItemModel } from '@statistics/statistics-model';

export const sortWithTagPriority = (a: StatisticsItemModel, b: StatisticsItemModel): number => {
  if (a.tag === '#movie') return -1;
  if (b.tag === '#movie') return 1;
  if (a.tag === '#series') return -1;
  if (b.tag === '#series') return 1;

  return a.count > b.count ? -1 : a.count < b.count ? 1 : 0;
};
